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
    let movingPiece = false; // Track if a piece is currently in motion
    let scores = { player1: 0, player2: 0 }; // Black is player1, White is player2
    let moves_history = [];

    // Game state object
    let gameState = {
        board: Array(9).fill(null),
        current_player: 'black',
        game_over: false,
        winner: null,
        opponent_type: 'human'
    };

    // Valid moves map (adjacency list)
    const validMoves = {
        0: [1, 3, 4],      // Position 1 can move to 2, 4, 5
        1: [0, 2, 4],      // Position 2 can move to 1, 3, 5
        2: [1, 4, 5],      // Position 3 can move to 2, 5, 6
        3: [0, 4, 6],      // Position 4 can move to 1, 5, 7
        4: [0, 1, 2, 3, 5, 6, 7, 8],  // Position 5 can move to all adjacent
        5: [2, 4, 8],      // Position 6 can move to 3, 5, 9
        6: [3, 4, 7],      // Position 7 can move to 4, 5, 8
        7: [4, 6, 8],      // Position 8 can move to 5, 7, 9
        8: [4, 5, 7]       // Position 9 can move to 5, 6, 8
    };

    // Winning combinations (all must pass through the center which is index 4)
    const winningCombinations = [
        [0, 4, 8],  // Diagonal top-left to bottom-right
        [2, 4, 6],  // Diagonal top-right to bottom-left
        [1, 4, 7],  // Vertical middle
        [3, 4, 5],  // Horizontal middle
    ];

    // Invalid moves as described in the requirements
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

        // Reset message
        messageDisplay.textContent = '';

        // Clear moves list
        movesList.innerHTML = '';
        moves_history = [];

        // Get the opponent type
        gameState.opponent_type = opponentSelect.value;
        gameState.current_player = 'black';
        gameState.game_over = false;
        gameState.winner = null;
        
        // Create a valid initial board that doesn't lead to quick wins
        createValidInitialBoard();
        
        // Update the display
        renderBoard();
        updateCurrentPlayerDisplay();
    }

    function createValidInitialBoard() {
        // Max attempts to find a valid board
        const maxAttempts = 100;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Generate random positions for pieces
            const positions = Array.from({length: 9}, (_, i) => i);
            shuffleArray(positions);
            
            // Assign positions for black pieces (first 3) and white pieces (next 3)
            const blackPositions = positions.slice(0, 3);
            const whitePositions = positions.slice(3, 6);
            
            // Initialize the board
            const board = Array(9).fill(null);
            blackPositions.forEach(pos => board[pos] = 'black');
            whitePositions.forEach(pos => board[pos] = 'white');
            
            // Check if initial state leads to an immediate win
            if (isWinningPosition(board, 'black') || isWinningPosition(board, 'white')) {
                continue;
            }
            
            // Check if game can end in <= 3 moves (simplified check)
            if (hasQuickWin(board, 3)) {
                continue;
            }
            
            // Valid board found
            gameState.board = board;
            return;
        }
        
        // If we can't find a perfect board after max attempts, just use one without immediate wins
        do {
            const positions = Array.from({length: 9}, (_, i) => i);
            shuffleArray(positions);
            
            const blackPositions = positions.slice(0, 3);
            const whitePositions = positions.slice(3, 6);
            
            gameState.board = Array(9).fill(null);
            blackPositions.forEach(pos => gameState.board[pos] = 'black');
            whitePositions.forEach(pos => gameState.board[pos] = 'white');
        } while (isWinningPosition(gameState.board, 'black') || isWinningPosition(gameState.board, 'white'));
    }

    // Helper function to shuffle an array
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Simplified function to check if there's a quick win available
    function hasQuickWin(board, maxMoves) {
        // This is a simplified version - just check some obvious patterns
        // For a real implementation, you'd need a more complex algorithm
        
        // If two pieces of the same color are already in a line with center and just need one more move
        for (const player of ['black', 'white']) {
            const playerPositions = [];
            board.forEach((cell, index) => {
                if (cell === player) playerPositions.push(index);
            });
            
            // Check each winning combination
            for (const combo of winningCombinations) {
                const matches = combo.filter(pos => playerPositions.includes(pos));
                // If two out of three positions already occupied by the same player
                // and the third position is empty, it's a potential quick win
                if (matches.length === 2) {
                    const emptyPos = combo.find(pos => !board[pos]);
                    if (emptyPos !== undefined) {
                        return true;
                    }
                }
            }
        }
        
        return false;
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

        // Check if the move is in the valid moves map
        return validMoves[fromPos].includes(toPos);
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
            // Make the move in our game state
            const player = gameState.current_player;
            gameState.board[fromPosition] = null;
            gameState.board[toPosition] = player;
            
            // Add to move history
            const moveRecord = {
                player: player,
                from: fromPosition,
                to: toPosition,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            
            moves_history.push(moveRecord);
            updateMovesHistory();
            
            // Check for win
            if (isWinningPosition(gameState.board, player)) {
                gameState.game_over = true;
                gameState.winner = player;
                // Update scores
                if (player === 'black') {
                    scores.player1 += 1;
                } else {
                    scores.player2 += 1;
                }
                updateScores();
                messageDisplay.textContent = `${player.charAt(0).toUpperCase() + player.slice(1)} wins!`;
            } else {
                // Switch player
                gameState.current_player = player === 'black' ? 'white' : 'black';
                updateCurrentPlayerDisplay();
                
                // If AI's turn
                if (gameState.opponent_type === 'ai' && gameState.current_player === 'white' && !gameState.game_over) {
                    // Use setTimeout to give a small delay before AI moves
                    setTimeout(() => {
                        const aiMove = getAIMove();
                        if (aiMove) {
                            const [fromPosAI, toPosAI] = aiMove;
                            animateAIMove(fromPosAI, toPosAI);
                        }
                    }, 500);
                }
            }
            
            // Clear selection
            if (selectedPiece) {
                selectedPiece.classList.remove('selected');
                selectedPiece = null;
            }
            
            // Render the board after the move
            renderBoard();
            
            // Clear valid moves
            cells.forEach(cell => {
                cell.classList.remove('valid-move');
            });
            
            movingPiece = false;
        }, 500); // Match the transition duration
    }
    
    function animateAIMove(fromPos, toPos) {
        movingPiece = true;
        
        // Create a temporary selected piece reference
        const fromCell = cells[fromPos];
        const aiPiece = fromCell.querySelector('.piece');
        
        // Highlight the AI's selected piece
        aiPiece.classList.add('selected');
        
        // Wait a moment to show the selection before moving
        setTimeout(() => {
            // Get positions for animation
            const toCell = cells[toPos];
            const fromRect = fromCell.getBoundingClientRect();
            const toRect = toCell.getBoundingClientRect();
            
            // Calculate translation
            const translateX = toRect.left - fromRect.left;
            const translateY = toRect.top - fromRect.top;
            
            // Set up animation
            aiPiece.style.transition = 'transform 0.5s ease';
            aiPiece.style.transform = `translate(${translateX}px, ${translateY}px)`;
            
            // Wait for animation to complete
            setTimeout(() => {
                // Make the move in our game state
                gameState.board[fromPos] = null;
                gameState.board[toPos] = 'white';
                
                // Add AI move to history
                const aiMoveRecord = {
                    player: 'white',
                    from: fromPos,
                    to: toPos,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                };
                moves_history.push(aiMoveRecord);
                updateMovesHistory();
                
                // Check for AI win
                if (isWinningPosition(gameState.board, 'white')) {
                    gameState.game_over = true;
                    gameState.winner = 'white';
                    scores.player2 += 1;
                    updateScores();
                    messageDisplay.textContent = 'White wins!';
                } else {
                    // Switch back to human player
                    gameState.current_player = 'black';
                    updateCurrentPlayerDisplay();
                }
                
                // Remove selection
                aiPiece.classList.remove('selected');
                
                // Render the board
                renderBoard();
                
                movingPiece = false;
            }, 500); // Match transition duration
        }, 300); // Small delay to show the selection
    }

    function getAIMove() {
        // Use minimax to find the best move for AI
        let bestScore = Infinity;
        let bestMove = null;
        
        for (let fromPos = 0; fromPos < 9; fromPos++) {
            if (gameState.board[fromPos] === 'white') {
                for (let toPos = 0; toPos < 9; toPos++) {
                    if (gameState.board[toPos] === null && isValidMove(fromPos, toPos)) {
                        // Make the move
                        const boardCopy = [...gameState.board];
                        boardCopy[fromPos] = null;
                        boardCopy[toPos] = 'white';
                        
                        // Evaluate the move
                        const score = minimax(boardCopy, 2, true, -Infinity, Infinity);
                        
                        if (score < bestScore) {
                            bestScore = score;
                            bestMove = [fromPos, toPos];
                        }
                    }
                }
            }
        }
        
        return bestMove;
    }

    function minimax(board, depth, isMaximizing, alpha, beta) {
        // Base cases: check if game over or max depth reached
        if (isWinningPosition(board, 'black')) {
            return 1; // Human wins
        }
        
        if (isWinningPosition(board, 'white')) {
            return -1; // AI wins
        }
        
        if (depth === 0) {
            return 0; // Neutral at max depth
        }
        
        if (isMaximizing) { // Human's turn (maximizing)
            let maxEval = -Infinity;
            
            for (let fromPos = 0; fromPos < 9; fromPos++) {
                if (board[fromPos] === 'black') {
                    for (let toPos = 0; toPos < 9; toPos++) {
                        if (board[toPos] === null && validMoves[fromPos].includes(toPos)) {
                            // Skip invalid moves
                            let isInvalid = false;
                            for (const [from, to] of invalidMoves) {
                                if (fromPos === from && toPos === to) {
                                    isInvalid = true;
                                    break;
                                }
                            }
                            if (isInvalid) continue;
                            
                            // Make move
                            const boardCopy = [...board];
                            boardCopy[fromPos] = null;
                            boardCopy[toPos] = 'black';
                            
                            const eval = minimax(boardCopy, depth - 1, false, alpha, beta);
                            maxEval = Math.max(maxEval, eval);
                            alpha = Math.max(alpha, eval);
                            
                            if (beta <= alpha) {
                                break; // Beta cutoff
                            }
                        }
                    }
                }
            }
            
            return maxEval;
        } else { // AI's turn (minimizing)
            let minEval = Infinity;
            
            for (let fromPos = 0; fromPos < 9; fromPos++) {
                if (board[fromPos] === 'white') {
                    for (let toPos = 0; toPos < 9; toPos++) {
                        if (board[toPos] === null && validMoves[fromPos].includes(toPos)) {
                            // Skip invalid moves
                            let isInvalid = false;
                            for (const [from, to] of invalidMoves) {
                                if (fromPos === from && toPos === to) {
                                    isInvalid = true;
                                    break;
                                }
                            }
                            if (isInvalid) continue;
                            
                            // Make move
                            const boardCopy = [...board];
                            boardCopy[fromPos] = null;
                            boardCopy[toPos] = 'white';
                            
                            const eval = minimax(boardCopy, depth - 1, true, alpha, beta);
                            minEval = Math.min(minEval, eval);
                            beta = Math.min(beta, eval);
                            
                            if (beta <= alpha) {
                                break; // Alpha cutoff
                            }
                        }
                    }
                }
            }
            
            return minEval;
        }
    }

    function isWinningPosition(board, player) {
        const playerPositions = [];
        board.forEach((cell, index) => {
            if (cell === player) playerPositions.push(index);
        });
        
        // Check each winning combination
        for (const combo of winningCombinations) {
            if (combo.every(pos => playerPositions.includes(pos))) {
                return true;
            }
        }
        
        return false;
    }

    function updateMovesHistory() {
        // Clear previous moves
        movesList.innerHTML = '';
        
        // Add each move to the history
        moves_history.forEach(move => {
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

    function updateScores() {
        scoreBlack.textContent = scores.player1;
        scoreWhite.textContent = scores.player2;
    }
});