from flask import Flask, render_template, jsonify, request, session
from flask_socketio import SocketIO
import os
import random
import json
from datetime import datetime
import itertools

app = Flask(__name__, template_folder='app/templates', static_folder='app/static')
app.config['SECRET_KEY'] = os.urandom(24)
socketio = SocketIO(app)

# Game state
scores = {'player1': 0, 'player2': 0}
moves_history = []
game_state = {
    'board': [None] * 9,  # Representing the 3x3 grid
    'current_player': 'black',  # black or white
    'game_over': False,
    'winner': None,
    'opponent_type': 'human',  # human or AI
}

# Valid moves map (adjacency list)
valid_moves = {
    0: [1, 3, 4],      # Position 1 can move to 2, 4, 5
    1: [0, 2, 4],      # Position 2 can move to 1, 3, 5
    2: [1, 4, 5],      # Position 3 can move to 2, 5, 6
    3: [0, 4, 6],      # Position 4 can move to 1, 5, 7
    4: [0, 1, 2, 3, 5, 6, 7, 8],  # Position 5 can move to all adjacent
    5: [2, 4, 8],      # Position 6 can move to 3, 5, 9
    6: [3, 4, 7],      # Position 7 can move to 4, 5, 8
    7: [4, 6, 8],      # Position 8 can move to 5, 7, 9
    8: [4, 5, 7]       # Position 9 can move to 5, 6, 8
}

# Winning combinations (all must pass through the center which is index 4)
winning_combinations = [
    [0, 4, 8],  # Diagonal top-left to bottom-right
    [2, 4, 6],  # Diagonal top-right to bottom-left
    [1, 4, 7],  # Vertical middle
    [3, 4, 5],  # Horizontal middle
]

# Invalid moves as described in the requirements
invalid_moves = [
    (1, 3), (3, 1),  # 1 <-> 3
    (3, 7), (7, 3),  # 4 <-> 7
    (7, 5), (5, 7),  # 7 <-> 5
    (5, 1), (1, 5),  # 5 <-> 1
]

@app.route('/')
def index():
    """Render the main game page."""
    return render_template('index.html')

@app.route('/new_game', methods=['POST'])
def new_game():
    """Start a new game with random piece positions."""
    global game_state, moves_history
    
    opponent_type = request.json.get('opponent_type', 'human')
    game_state['opponent_type'] = opponent_type
    game_state['current_player'] = 'black'
    game_state['game_over'] = False
    game_state['winner'] = None
    
    # Clear move history for new game
    moves_history = []
    
    # Create a valid initial board that doesn't lead to quick wins
    board = create_valid_initial_board()
    game_state['board'] = board
    
    return jsonify({
        'status': 'success',
        'game_state': game_state,
        'scores': scores,
        'moves_history': moves_history
    })

def create_valid_initial_board():
    """Create a valid initial board that doesn't lead to quick wins."""
    max_attempts = 100  # Limit attempts to prevent infinite loop
    for _ in range(max_attempts):
        # Initialize the board with random positions for pieces
        positions = list(range(9))
        random.shuffle(positions)
        
        # Assign positions for black pieces (first 3) and white pieces (next 3)
        black_positions = positions[:3]
        white_positions = positions[3:6]
        
        # Initialize the board
        board = [None] * 9
        for pos in black_positions:
            board[pos] = 'black'
        for pos in white_positions:
            board[pos] = 'white'
        
        # Check if initial state leads to an immediate win
        if is_winning_position(board, 'black') or is_winning_position(board, 'white'):
            continue
            
        # Check if game can end in <= 3 moves
        if can_win_in_n_moves(board, 3):
            continue
            
        return board
        
    # If we can't find a valid board after max attempts, just return one without immediate wins
    positions = list(range(9))
    random.shuffle(positions)
    black_positions = positions[:3]
    white_positions = positions[3:6]
    board = [None] * 9
    for pos in black_positions:
        board[pos] = 'black'
    for pos in white_positions:
        board[pos] = 'white'
    while is_winning_position(board, 'black') or is_winning_position(board, 'white'):
        random.shuffle(positions)
        black_positions = positions[:3]
        white_positions = positions[3:6]
        board = [None] * 9
        for pos in black_positions:
            board[pos] = 'black'
        for pos in white_positions:
            board[pos] = 'white'
    return board

def can_win_in_n_moves(board, n):
    """Check if either player can win in n or fewer moves."""
    if n <= 0 or is_winning_position(board, 'black') or is_winning_position(board, 'white'):
        return is_winning_position(board, 'black') or is_winning_position(board, 'white')
    
    # Try all possible moves for current player (black goes first)
    current_player = 'black'
    for from_pos in range(9):
        if board[from_pos] == current_player:
            for to_pos in valid_moves[from_pos]:
                if to_pos in valid_moves[from_pos] and board[to_pos] is None and (from_pos, to_pos) not in invalid_moves:
                    # Make the move
                    new_board = board.copy()
                    new_board[from_pos] = None
                    new_board[to_pos] = current_player
                    
                    # Check if next player can win in n-1 moves
                    next_player = 'white' if current_player == 'black' else 'black'
                    if can_win_in_n_moves_after_move(new_board, n-1, next_player):
                        return True
    
    return False

def can_win_in_n_moves_after_move(board, n, current_player):
    """Helper function to check if player can win in n moves after a move has been made."""
    # Base case: check if current state is a win
    if is_winning_position(board, 'black') or is_winning_position(board, 'white'):
        return True
        
    if n <= 0:
        return False
    
    # Try all possible moves for current player
    for from_pos in range(9):
        if board[from_pos] == current_player:
            for to_pos in valid_moves[from_pos]:
                if to_pos in valid_moves[from_pos] and board[to_pos] is None and (from_pos, to_pos) not in invalid_moves:
                    # Make the move
                    new_board = board.copy()
                    new_board[from_pos] = None
                    new_board[to_pos] = current_player
                    
                    # If this move wins, return True
                    if is_winning_position(new_board, current_player):
                        return True
                    
                    # Otherwise check if opponent can win in n-1 moves
                    next_player = 'white' if current_player == 'black' else 'black'
                    if can_win_in_n_moves_after_move(new_board, n-1, next_player):
                        return True
    
    return False

@app.route('/move', methods=['POST'])
def move():
    """Handle a player's move."""
    global moves_history
    from_pos = request.json.get('from_pos')
    to_pos = request.json.get('to_pos')
    player = request.json.get('player')
    
    if game_state['game_over']:
        return jsonify({'status': 'error', 'message': 'Game is over'})
    
    if game_state['current_player'] != player:
        return jsonify({'status': 'error', 'message': 'Not your turn'})
    
    # Validate move
    if not is_valid_move(from_pos, to_pos, player):
        return jsonify({'status': 'error', 'message': 'Invalid move'})
    
    # Make move
    game_state['board'][from_pos] = None
    game_state['board'][to_pos] = player
    
    # Add to move history
    move_record = {
        'player': player,
        'from': from_pos,
        'to': to_pos,
        'timestamp': datetime.now().strftime('%H:%M:%S')
    }
    moves_history.append(move_record)
    
    # Check for win
    if is_winning_position(game_state['board'], player):
        game_state['game_over'] = True
        game_state['winner'] = player
        # Update scores
        if player == 'black':
            scores['player1'] += 1
        else:
            scores['player2'] += 1
    else:
        # Switch player
        game_state['current_player'] = 'white' if player == 'black' else 'black'
        
        # If AI's turn and not game over
        if game_state['opponent_type'] == 'ai' and game_state['current_player'] == 'white' and not game_state['game_over']:
            ai_move = get_ai_move()
            if ai_move:
                from_pos_ai, to_pos_ai = ai_move
                game_state['board'][from_pos_ai] = None
                game_state['board'][to_pos_ai] = 'white'
                
                # Add AI move to history
                ai_move_record = {
                    'player': 'white',
                    'from': from_pos_ai,
                    'to': to_pos_ai,
                    'timestamp': datetime.now().strftime('%H:%M:%S')
                }
                moves_history.append(ai_move_record)
                
                # Check for AI win
                if is_winning_position(game_state['board'], 'white'):
                    game_state['game_over'] = True
                    game_state['winner'] = 'white'
                    scores['player2'] += 1
                else:
                    # Switch back to human player
                    game_state['current_player'] = 'black'
    
    return jsonify({
        'status': 'success',
        'game_state': game_state,
        'scores': scores,
        'moves_history': moves_history
    })

def is_valid_move(from_pos, to_pos, player):
    """Check if a move is valid."""
    # Check if the from_pos contains the player's piece
    if game_state['board'][from_pos] != player:
        return False
    
    # Check if to_pos is empty
    if game_state['board'][to_pos] is not None:
        return False
    
    # Check if move is in valid_moves map and not in invalid_moves
    if to_pos not in valid_moves[from_pos] or (from_pos, to_pos) in invalid_moves:
        return False
    
    return True

def is_winning_position(board, player):
    """Check if the current board position is a win for the player."""
    player_positions = [i for i, piece in enumerate(board) if piece == player]
    
    # Check each winning combination
    for combo in winning_combinations:
        if all(pos in player_positions for pos in combo):
            return True
    
    return False

# Rest of the code remains the same
def minimax(board, depth, is_maximizing, alpha, beta):
    """Minimax algorithm with alpha-beta pruning for AI decision making."""
    # The AI is white (minimizer) and the human is black (maximizer)
    if is_winning_position(board, 'black'):
        return 1  # Human wins, high score
    
    if is_winning_position(board, 'white'):
        return -1  # AI wins, low score
    
    if depth == 0:
        return 0  # Neutral at max depth
    
    if is_maximizing:  # Human's turn
        max_eval = float('-inf')
        for from_pos in range(9):
            if board[from_pos] == 'black':
                for to_pos in valid_moves[from_pos]:
                    if board[to_pos] is None and (from_pos, to_pos) not in invalid_moves:
                        # Make move
                        board_copy = board.copy()
                        board_copy[from_pos] = None
                        board_copy[to_pos] = 'black'
                        
                        eval = minimax(board_copy, depth - 1, False, alpha, beta)
                        max_eval = max(max_eval, eval)
                        alpha = max(alpha, eval)
                        
                        if beta <= alpha:
                            break
        return max_eval
    else:  # AI's turn
        min_eval = float('inf')
        for from_pos in range(9):
            if board[from_pos] == 'white':
                for to_pos in valid_moves[from_pos]:
                    if board[to_pos] is None and (from_pos, to_pos) not in invalid_moves:
                        # Make move
                        board_copy = board.copy()
                        board_copy[from_pos] = None
                        board_copy[to_pos] = 'white'
                        
                        eval = minimax(board_copy, depth - 1, True, alpha, beta)
                        min_eval = min(min_eval, eval)
                        beta = min(beta, eval)
                        
                        if beta <= alpha:
                            break
        return min_eval

def get_ai_move():
    """Get the best move for the AI using minimax algorithm."""
    best_score = float('inf')
    best_move = None
    
    for from_pos in range(9):
        if game_state['board'][from_pos] == 'white':
            for to_pos in valid_moves[from_pos]:
                if game_state['board'][to_pos] is None and (from_pos, to_pos) not in invalid_moves:
                    # Make move
                    board_copy = game_state['board'].copy()
                    board_copy[from_pos] = None
                    board_copy[to_pos] = 'white'
                    
                    # Evaluate move with minimax - looking 2 steps ahead
                    score = minimax(board_copy, 2, True, float('-inf'), float('inf'))
                    
                    if score < best_score:
                        best_score = score
                        best_move = (from_pos, to_pos)
    
    return best_move

@app.route('/get_game_state', methods=['GET'])
def get_game_state():
    """Return the current game state."""
    return jsonify({
        'game_state': game_state,
        'scores': scores,
        'moves_history': moves_history
    })

if __name__ == '__main__':
    socketio.run(app, debug=True)