document.addEventListener('DOMContentLoaded', () => {
    // Game elements
    const cells = document.querySelectorAll('.cell');
    const newGameBtn = document.getElementById('new-game-btn');
    const opponentSelect = document.getElementById('opponent-type');
    const currentPlayerDisplay = document.querySelector('#current-player span');
    const messageDisplay = document.getElementById('message');
    const scoreBlack = document.getElementById('score-black');
    const scoreWhite = document.getElementById('score-white');
    const movesList = document.getElementById('moves-list');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    // Game state
    let selectedPiece = null;
    let gameState = {
        board: Array(9).fill(null),
        current_player: 'black',
        game_over: false,
        winner: null,
        opponent_type: 'human'
    };
    let movingPiece = false; // Track if a piece is currently in motion

    // Invalid moves (specific to game rules)
    const invalidMoves = [
        [1, 3], [3, 1],  // 2 <-> 4
        [3, 7], [7, 3],  // 4 <-> 8
        [7, 5], [5, 7],  // 8 <-> 6
        [5, 1], [1, 5]   // 6 <-> 2
    ];

    // Start a new game when the page loads
    startNewGame();

    // Start a new game when the button is clicked
    newGameBtn.addEventListener('click', startNewGame);

    // Handle cell clicks
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    // Handle theme toggle
    themeToggleBtn.addEventListener('change', toggleTheme);

    // Initialize theme based on user preference (if any)
    initTheme();

    function initTheme() {
        // Check if user has a saved preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggleBtn.checked = true;
        }
    }

    function toggleTheme() {
        if (themeToggleBtn.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    }

    function startNewGame() {
        // Clear any previously selected piece
        if (selectedPiece) {
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
        }

        // Clear any valid move highlighting
        cells.forEach(cell => {
            cell.classList.remove('valid-move');
            
            // Remove any existing pieces
            const piece = cell.querySelector('.piece');
            if (piece) {
                cell.removeChild(piece);
            }
        });

        // Clear moves list
        movesList.innerHTML = '';

        // Reset message
        messageDisplay.textContent = '';

        // Get the opponent type
        const opponentType = opponentSelect.value;

        // Start a new game via API
        fetch('/new_game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ opponent_type: opponentType })
        })
        .then(response => response.json())
        .then(data => {
            gameState = data.game_state;
            updateScores(data.scores);
            renderBoard();
            updateCurrentPlayerDisplay();
        })
        .catch(error => {
            console.error('Error starting new game:', error);
            messageDisplay.textContent = 'Error starting new game. Please try again.';
        });
    }

    function handleCellClick(event) {
        const cell = event.currentTarget;
        const position = parseInt(cell.dataset.position);

        // If game is over, don't allow any moves
        if (gameState.game_over) {
            messageDisplay.textContent = `Game over! ${gameState.winner.charAt(0).toUpperCase() + gameState.winner.slice(1)} wins!`;
            return;
        }

        // If a piece is currently moving, ignore clicks
        if (movingPiece) {
            return;
        }

        // Check if the cell has a piece and it's the current player's piece
        const piece = cell.querySelector('.piece');
        if (piece && piece.classList.contains(gameState.current_player)) {
            // If there's already a selected piece, deselect it
            if (selectedPiece) {
                selectedPiece.classList.remove('selected');
            }
            
            // Select this piece and show valid moves
            piece.classList.add('selected');
            selectedPiece = piece;
            
            // Highlight valid moves
            showValidMoves(position);
            
            return;
        }

        // If a piece is selected and the cell is empty, try to move there
        if (selectedPiece) {
            const fromPosition = parseInt(selectedPiece.parentElement.dataset.position);
            
            // Check if move is valid
            if (cell.classList.contains('valid-move')) {
                movePiece(fromPosition, position);
            } else {
                messageDisplay.textContent = 'Invalid move!';
            }
        }
    }

    function showValidMoves(position) {
        // Clear any previous valid move indicators
        cells.forEach(cell => {
            cell.classList.remove('valid-move');
        });

        // Check each cell for valid moves
        cells.forEach(cell => {
            const targetPosition = parseInt(cell.dataset.position);
            
            // Skip if the cell is not empty
            if (cell.querySelector('.piece')) {
                return;
            }
            
            // Check if the move is valid based on the game rules
            if (isValidMove(position, targetPosition)) {
                cell.classList.add('valid-move');
            }
        });
    }

    function isValidMove(fromPos, toPos) {
        // Check if the move is invalid based on the game rules
        for (const [from, to] of invalidMoves) {
            if (fromPos === from && toPos === to) {
                return false;
            }
        }

        // Check if the cells are adjacent (including diagonals if valid)
        const fromRow = Math.floor(fromPos / 3);
        const fromCol = fromPos % 3;
        const toRow = Math.floor(toPos / 3);
        const toCol = toPos % 3;
        
        // Check if moving more than one cell away
        const rowDiff = Math.abs(fromRow - toRow);
        const colDiff = Math.abs(fromCol - toCol);
        
        // Valid moves are to adjacent cells (1 step away)
        return rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0);
    }

    function movePiece(fromPosition, toPosition) {
        // Flag that a piece is currently moving to prevent multiple clicks
        movingPiece = true;

        // Get the positions for animation
        const fromCell = cells[fromPosition];
        const toCell = cells[toPosition];
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        
        // Calculate translation values
        const translateX = toRect.left - fromRect.left;
        const translateY = toRect.top - fromRect.top;
        
        // Set up animation
        const piece = selectedPiece;
        piece.style.transition = 'transform 0.5s ease';
        piece.style.transform = `translate(${translateX}px, ${translateY}px)`;
        
        // Wait for animation to complete
        setTimeout(() => {
            // Send move to server
            fetch('/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from_pos: fromPosition,
                    to_pos: toPosition,
                    player: gameState.current_player
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'error') {
                    messageDisplay.textContent = data.message;
                    // Reset the piece position
                    piece.style.transform = '';
                } else {
                    gameState = data.game_state;
                    updateScores(data.scores);
                    renderBoard();
                    updateCurrentPlayerDisplay();
                    updateMovesHistory(data.moves_history);
                    
                    // Check for game over
                    if (gameState.game_over) {
                        messageDisplay.textContent = `${gameState.winner.charAt(0).toUpperCase() + gameState.winner.slice(1)} wins!`;
                    } else {
                        messageDisplay.textContent = '';
                    }
                }
                
                // Clear selection and reset moving flag
                if (selectedPiece) {
                    selectedPiece.classList.remove('selected');
                    selectedPiece = null;
                }
                
                movingPiece = false;
            })
            .catch(error => {
                console.error('Error making move:', error);
                messageDisplay.textContent = 'Error making move. Please try again.';
                
                // Reset the piece position
                piece.style.transform = '';
                movingPiece = false;
            });
            
            // Clear valid moves
            cells.forEach(cell => {
                cell.classList.remove('valid-move');
            });
        }, 500); // Match the transition duration
    }

    function updateMovesHistory(moves) {
        // Clear previous moves
        movesList.innerHTML = '';
        
        // Add each move to the history
        moves.forEach(move => {
            const moveItem = document.createElement('div');
            moveItem.className = 'move-item';
            
            const timestamp = document.createElement('span');
            timestamp.className = 'timestamp';
            timestamp.textContent = move.timestamp;
            
            const player = document.createElement('span');
            player.className = `player ${move.player}`;
            player.textContent = `${move.player.charAt(0).toUpperCase() + move.player.slice(1)}:`;
            
            const moveText = document.createElement('span');
            moveText.textContent = `${move.from + 1} → ${move.to + 1}`;
            
            moveItem.appendChild(timestamp);
            moveItem.appendChild(player);
            moveItem.appendChild(moveText);
            movesList.appendChild(moveItem);
        });
        
        // Scroll to the bottom of the moves list
        movesList.scrollTop = movesList.scrollHeight;
    }

    function renderBoard() {
        // Clear the board
        cells.forEach(cell => {
            // Remove any existing pieces
            const existingPiece = cell.querySelector('.piece');
            if (existingPiece) {
                cell.removeChild(existingPiece);
            }
        });

        // Render the pieces based on the current game state
        gameState.board.forEach((piece, position) => {
            if (piece) {
                const cell = cells[position];
                const pieceElement = document.createElement('div');
                pieceElement.className = `piece ${piece}`;
                cell.appendChild(pieceElement);
            }
        });
    }

    function updateCurrentPlayerDisplay() {
        const playerName = gameState.current_player.charAt(0).toUpperCase() + gameState.current_player.slice(1);
        currentPlayerDisplay.textContent = playerName;
    }

    function updateScores(scores) {
        scoreBlack.textContent = scores.player1;
        scoreWhite.textContent = scores.player2;
    }
});