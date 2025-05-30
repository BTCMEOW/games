# 2D Runner Game

A simple 2D runner game made with PyGame.

## Features
- Smooth player movement
- Enemy spawning system
- Score tracking
- Background parallax effect
- Particle effects
- Day/Night cycle based on score

## Controls
- LEFT/RIGHT: Move
- SPACE: Jump
- F: Attack
- E: Special attack
- Q: Block
- DOWN: Toggle invisibility
- R: Restart game

## Installation

1. Clone the repository:
```bash
git clone https://github.com/BTCMEOW/games.git
cd games/2DBTCMeowNoirRunner
```

2. Install requirements:
```bash
pip install -r requirements.txt
```

3. Run the game:
```bash
python main.py
```

## Game Structure
```
2DBTCMeowNoirRunner/
├── assets/
│   ├── bg.png
│   ├── bg_layer_0.png
│   ├── bg_layer_1.png
│   ├── player.png
│   ├── cat_run.png
│   ├── cat_jump.png
│   ├── cat_attack.png
│   └── enemy_basic.png
├── main.py
├── player.py
├── enemy.py
├── background.py
├── utils.py
├── requirements.txt
└── README.md
```

## Troubleshooting

If you encounter any issues:

1. Make sure all required files are in the correct directories
2. Check that all assets are present in the assets folder
3. Verify Python version (3.8+ recommended)
4. Ensure all dependencies are installed

## Development
- Python 3.8+
- PyGame 2.5.2
- asyncio 3.4.3 