
import pygame
import sys
import random
import asyncio
import os
import json

# Initialize pygame
pygame.init()
pygame.mixer.init()

# Game constants
WIDTH, HEIGHT = 800, 600
FPS = 60
TITLE = "My Game"
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
DEBUG_RED = (255, 0, 0)
PLAYER_MAX_HEALTH = 200
PLAYER_HEALTH_REGEN = 0.5
PLAYER_HEALTH_REGEN_DELAY = 3
GROUND_LEVEL = 500
PLAYER_START_X = 100
DEBUG_MODE = True
ENEMY_SPAWN_RATE = 2000  # ms between enemy spawns
MAX_ENEMIES = 5  # Limit maximum number of enemies
PARTICLE_LIMIT = 50  # Limit maximum number of particles

# Physics constants
GRAVITY = 0.8
JUMP_STRENGTH = -15
PLAYER_SPEED = 5
ENEMY_SPEED_MIN = 2
ENEMY_SPEED_MAX = 4

# Visual effects
PARTICLE_COLORS = [(255, 0, 0), (255, 165, 0), (255, 255, 0)]  # Red, Orange, Yellow
HIT_FLASH_DURATION = 0.1  # seconds

# Animation constants
ANIMATION_SPEED = 0.1  # seconds per frame
PLAYER_ANIMATIONS = {
    "idle": ["idle_1", "idle_2"],
    "run": ["run_1", "run_2", "run_3"],
    "jump": ["jump_1"],
    "attack": ["attack_1", "attack_2"],
    "special_attack": ["special_1", "special_2", "special_3"],
    "block": ["block_1"],
    "hit": ["hit_1"]
}

ENEMY_ANIMATIONS = {
    "basic": {
        "idle": ["basic_idle_1", "basic_idle_2"],
        "walk": ["basic_walk_1", "basic_walk_2"],
        "hit": ["basic_hit_1"]
    },
    "strong": {
        "idle": ["strong_idle_1", "strong_idle_2"],
        "walk": ["strong_walk_1", "strong_walk_2"],
        "hit": ["strong_hit_1"]
    }
}

# Set up paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_PATH = os.path.join(BASE_DIR, "assets")

# Ensure assets directory exists
if not os.path.exists(ASSETS_PATH):
    os.makedirs(ASSETS_PATH)

# Enemy types and their health
ENEMY_HEALTH = {
    "basic": 30,
    "strong": 50
}

class Animation:
    def __init__(self, frames, speed=ANIMATION_SPEED):
        self.frames = frames
        self.speed = speed
        self.current_frame = 0
        self.timer = 0
        self.is_playing = False
        self.loop = True
        
    def update(self, dt):
        if not self.is_playing:
            return
            
        self.timer += dt
        if self.timer >= self.speed:
            self.timer = 0
            self.current_frame = (self.current_frame + 1) % len(self.frames)
            
    def play(self):
        self.is_playing = True
        self.current_frame = 0
        self.timer = 0
        
    def stop(self):
        self.is_playing = False
        self.current_frame = 0
        self.timer = 0
        
    def get_current_frame(self):
        return self.frames[self.current_frame]

class Background:
    def __init__(self):
        self.layers = []
        self.speeds = [0.5, 1.0, 2.0]  # Different speeds for parallax effect
        self.current_theme = 0
        self.themes = [
            (255, 255, 255),  # 0-999: normal
            (100, 100, 150),  # 1000-1999: night tint
            (255, 200, 100),  # 2000-2999: sunset tint
            (200, 255, 255)   # 3000+: morning tint
        ]
        self.load_layers()
        
    def load_layers(self):
        # Load background layers
        try:
            # Load main background
            bg = pygame.image.load(os.path.join(ASSETS_PATH, "bg.png")).convert()
            bg = pygame.transform.scale(bg, (WIDTH, HEIGHT))
            self.layers.append({"image": bg, "x": 0, "speed": self.speeds[0]})
            
            # Load additional layers if they exist
            for i in range(2):  # Try to load layer_0 and layer_1
                try:
                    layer = pygame.image.load(os.path.join(ASSETS_PATH, f"bg_layer_{i}.png")).convert_alpha()
                    layer = pygame.transform.scale(layer, (WIDTH, HEIGHT))
                    self.layers.append({"image": layer, "x": 0, "speed": self.speeds[i + 1]})
                except:
                    pass
        except pygame.error as e:
            print(f"Error loading background: {e}")
            # Create placeholder if image is missing
            surf = pygame.Surface((WIDTH, HEIGHT))
            surf.fill((100, 100, 255))  # Blue background as placeholder
            self.layers.append({"image": surf, "x": 0, "speed": 1.0})
            
    def update(self, score):
        # Check if we need to change theme
        new_theme = min(score // 1000, len(self.themes) - 1)
        if new_theme != self.current_theme:
            self.current_theme = new_theme
            
        # Update layer positions
        for layer in self.layers:
            layer["x"] -= layer["speed"]
            if layer["x"] <= -WIDTH:
                layer["x"] = 0
            
    def draw(self, screen):
        # Create a surface for the background
        bg_surface = pygame.Surface((WIDTH, HEIGHT))
        bg_surface.fill((0, 0, 0))  # Fill with black first
        
        # Draw all layers
        for layer in self.layers:
            bg_surface.blit(layer["image"], (layer["x"], 0))
            bg_surface.blit(layer["image"], (layer["x"] + WIDTH, 0))
            
        # Apply color tint based on theme
        tint = self.themes[self.current_theme]
        tint_surface = pygame.Surface((WIDTH, HEIGHT))
        tint_surface.fill(tint)
        tint_surface.set_alpha(50)  # Make tint semi-transparent
        bg_surface.blit(tint_surface, (0, 0), special_flags=pygame.BLEND_MULT)
        
        # Draw the final background
        screen.blit(bg_surface, (0, 0))

class Particle:
    def __init__(self, x, y, color):
        self.x = x
        self.y = y
        self.color = color
        self.size = random.randint(2, 4)
        self.life = 1.0  # seconds
        self.velocity = [random.uniform(-2, 2), random.uniform(-2, 2)]
        
    def update(self, dt):
        self.x += self.velocity[0]
        self.y += self.velocity[1]
        self.life -= dt
        return self.life > 0
        
    def draw(self, screen):
        alpha = int(self.life * 255)
        color = (*self.color, alpha)
        surf = pygame.Surface((self.size, self.size), pygame.SRCALPHA)
        pygame.draw.circle(surf, color, (self.size//2, self.size//2), self.size//2)
        screen.blit(surf, (int(self.x), int(self.y)))

class Player(pygame.sprite.Sprite):
    def __init__(self, x, y):
        pygame.sprite.Sprite.__init__(self)
        self.rect = pygame.Rect(x, y, 50, 80)
        self.health = PLAYER_MAX_HEALTH
        self.current_state = "idle"
        self.attacking = False
        self.attack_rect = pygame.Rect(0, 0, 0, 0)
        self.attack_timer = 0
        self.attack_duration = 0.3
        self.hidden = False
        self.was_hit = False
        self.facing_right = True
        
        # Health regeneration
        self.last_damage_time = 0
        self.health_regen_timer = 0
        
        # Animation properties
        self.animation_timer = 0
        self.animation_frame = 0
        self.animation_speed = 0.1
        self.hit_flash_timer = 0
        self.particles = []
        
        # Invisibility mechanics
        self.invisibility_timer = 0
        self.invisibility_duration = 5
        self.invisibility_cooldown = 0
        self.invisibility_cooldown_duration = 10
        
        # Load player sprites
        self.sprites = {
            "idle": self.load_sprite("player.png"),
            "run": self.load_sprite("cat_run.png"),
            "jump": self.load_sprite("cat_jump.png"),
            "attack": self.load_sprite("cat_attack.png")
        }
        
        # Set initial image
        self.image = self.sprites["idle"]
        
        # Physics properties
        self.velocity_x = 0
        self.velocity_y = 0
        self.jumping = False
        self.on_ground = True
        
    def load_sprite(self, filename):
        try:
            image = pygame.image.load(os.path.join(ASSETS_PATH, filename)).convert_alpha()
            return pygame.transform.scale(image, (50, 80))
        except:
            surf = pygame.Surface((50, 80))
            surf.fill((255, 0, 0))
            return surf
        
    def add_particle(self, x, y, color):
        if len(self.particles) < PARTICLE_LIMIT:
            self.particles.append(Particle(x, y, color))

    def update(self, keys=None):
        if keys is None:
            keys = pygame.key.get_pressed()
            
        # Update attack timer
        if self.attacking:
            self.attack_timer += 1/FPS
            if self.attack_timer >= self.attack_duration:
                self.attacking = False
                self.attack_timer = 0
            
        # Update invisibility
        if self.hidden:
            self.invisibility_timer -= 1/FPS
            if self.invisibility_timer <= 0:
                self.hidden = False
                self.invisibility_cooldown = self.invisibility_cooldown_duration
        elif self.invisibility_cooldown > 0:
            self.invisibility_cooldown -= 1/FPS
            
        # Health regeneration
        current_time = pygame.time.get_ticks() / 1000
        if current_time - self.last_damage_time > PLAYER_HEALTH_REGEN_DELAY:
            self.health_regen_timer += 1/FPS
            if self.health_regen_timer >= 1:
                self.health = min(PLAYER_MAX_HEALTH, self.health + PLAYER_HEALTH_REGEN)
                self.health_regen_timer = 0
                
                if self.health < PLAYER_MAX_HEALTH:
                    for _ in range(2):
                        self.add_particle(
                            self.rect.centerx + random.randint(-20, 20),
                            self.rect.top + random.randint(0, 20),
                            (0, 255, 0)
                        )
            
        # Movement
        self.velocity_x = 0
        if keys[pygame.K_LEFT]:
            self.velocity_x = -PLAYER_SPEED
            self.facing_right = False
        if keys[pygame.K_RIGHT]:
            self.velocity_x = PLAYER_SPEED
            self.facing_right = True
            
        # Apply gravity
        self.velocity_y += GRAVITY
        
        # Update position
        self.rect.x += self.velocity_x
        self.rect.y += self.velocity_y
        
        # Keep player on screen horizontally
        self.rect.x = max(0, min(WIDTH - self.rect.width, self.rect.x))
        
        # Ground collision
        if self.rect.bottom >= GROUND_LEVEL:
            self.rect.bottom = GROUND_LEVEL
            self.velocity_y = 0
            self.on_ground = True
            self.jumping = False
            
            if self.velocity_y > 0:
                for _ in range(5):
                    self.add_particle(
                        self.rect.centerx + random.randint(-20, 20),
                        self.rect.bottom,
                        (200, 200, 200)
                    )
        else:
            self.on_ground = False
        
        # Update animation
        self.animation_timer += 1/FPS
        if self.animation_timer >= self.animation_speed:
            self.animation_timer = 0
            self.animation_frame = (self.animation_frame + 1) % 2
            
            if self.attacking:
                self.image = self.sprites["attack"]
            elif not self.on_ground:
                self.image = self.sprites["jump"]
            elif self.velocity_x != 0:
                self.image = self.sprites["run"]
            else:
                self.image = self.sprites["idle"]
            
            if not self.facing_right:
                self.image = pygame.transform.flip(self.image, True, False)
                
        # Update hit flash
        if self.hit_flash_timer > 0:
            self.hit_flash_timer -= 1/FPS
            if self.hit_flash_timer <= 0:
                self.image.set_alpha(255)
                
        # Update particles
        self.particles = [p for p in self.particles if p.update(1/FPS)]
            
        # Apply invisibility effect
        if self.hidden:
            self.image.set_alpha(128)
        else:
            self.image.set_alpha(255)

    def jump(self):
        if self.on_ground and not self.jumping:
            self.jumping = True
            self.velocity_y = JUMP_STRENGTH
            self.on_ground = False
            
            # Create jump particles
            for _ in range(3):
                self.add_particle(
                    self.rect.centerx + random.randint(-20, 20),
                    self.rect.bottom,
                    (200, 200, 200)
                )
            return True
        return False
        
    def attack(self):
        if not self.attacking:
            self.attacking = True
            self.attack_timer = 0
            self.attack_rect = pygame.Rect(
                self.rect.right if self.facing_right else self.rect.left - self.rect.width,
                self.rect.y, 
                self.rect.width, self.rect.height)
            return True
        return False
        
    def special_attack(self):
        return self.attack()  # Same as regular attack for now
        
    def block(self):
        return True
        
    def toggle_hide(self):
        if not self.hidden and self.invisibility_cooldown <= 0:
            self.hidden = True
            self.invisibility_timer = self.invisibility_duration
            return True
        return False
        
    def take_damage(self, amount):
        if not self.hidden:  # Can't take damage while invisible
            self.health -= amount
            self.last_damage_time = pygame.time.get_ticks() / 1000
            self.hit_flash_timer = HIT_FLASH_DURATION
            self.image.set_alpha(128)  # Flash effect
            
            # Create hit particles
            for _ in range(5):
                self.add_particle(
                    self.rect.centerx,
                    self.rect.centery,
                    random.choice(PARTICLE_COLORS)
                )
            return self.health <= 0
        return False

    def draw(self, screen):
        # Draw particles
        for particle in self.particles:
            particle.draw(screen)
            
        # Draw player
        screen.blit(self.image, self.rect)

class Enemy(pygame.sprite.Sprite):
    def __init__(self, enemy_type="basic"):
        pygame.sprite.Sprite.__init__(self)
        self.enemy_type = enemy_type
        self.health = ENEMY_HEALTH.get(enemy_type, 30)
        self.max_health = self.health
        
        # Spawn on ground
        self.rect = pygame.Rect(
            WIDTH, GROUND_LEVEL - 60,  # Fixed height from ground
            50, 60)
            
        # Load enemy sprite
        try:
            self.image = pygame.image.load(os.path.join(ASSETS_PATH, f"enemy_{enemy_type}.png")).convert_alpha()
            self.image = pygame.transform.scale(self.image, (50, 60))
        except:
            self.image = pygame.Surface((50, 60))
            self.image.fill((0, 0, 255))
            
        self.speed = random.randint(ENEMY_SPEED_MIN, ENEMY_SPEED_MAX)
        self.was_hit = False
        self.off_screen = False
        self.animation_timer = 0
        self.animation_frame = 0
        self.animation_speed = 0.2  # seconds per frame
        self.hit_flash_timer = 0
        self.particles = []
        
    def update(self):
        # Move horizontally
        self.rect.x -= self.speed
        if self.rect.right < 0:
            self.off_screen = True
            
        # Update animation
        self.animation_timer += 1/FPS
        if self.animation_timer >= self.animation_speed:
            self.animation_timer = 0
            self.animation_frame = (self.animation_frame + 1) % 2
            # Flip sprite horizontally for walking animation
            self.image = pygame.transform.flip(self.image, True, False)
            
        # Update hit flash
        if self.hit_flash_timer > 0:
            self.hit_flash_timer -= 1/FPS
            if self.hit_flash_timer <= 0:
                self.image.set_alpha(255)
                
        # Update particles
        self.particles = [p for p in self.particles if p.update(1/FPS)]
            
    def take_damage(self):
        self.health -= 10
        self.hit_flash_timer = HIT_FLASH_DURATION
        self.image.set_alpha(128)  # Flash effect
        
        # Create hit particles
        for _ in range(5):
            self.particles.append(Particle(
                self.rect.centerx,
                self.rect.centery,
                random.choice(PARTICLE_COLORS)
            ))
            
        if self.health <= 0:
            return True
        return False
        
    def draw(self, screen):
        # Draw particles
        for particle in self.particles:
            particle.draw(screen)
            
        # Draw enemy
        screen.blit(self.image, self.rect)
        
        # Draw health bar
        health_width = 40
        health_height = 5
        health_x = self.rect.x
        health_y = self.rect.y - 10
        
        # Background
        pygame.draw.rect(screen, (100, 100, 100), 
                        (health_x, health_y, health_width, health_height))
        # Health
        health_ratio = self.health / self.max_health
        pygame.draw.rect(screen, (200, 50, 50), 
                        (health_x, health_y, int(health_width * health_ratio), health_height))

def show_menu(screen):
    font = pygame.font.SysFont("Arial", 50)
    text = font.render("Press ENTER to start", True, WHITE)
    screen.blit(text, (WIDTH//2 - text.get_width()//2, HEIGHT//2 - text.get_height()//2))
    pygame.display.flip()

def show_game_over(screen):
    font = pygame.font.SysFont("Arial", 50)
    text = font.render("Game Over! Press R to restart", True, WHITE)
    screen.blit(text, (WIDTH//2 - text.get_width()//2, HEIGHT//2 - text.get_height()//2))
    pygame.display.flip()
    
    waiting = True
    while waiting:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN and event.key == pygame.K_r:
                waiting = False
                return True  # Return True to indicate restart
    return False

def load_sounds():
    sounds = {}
    sound_files = {
        "jump": "jump.wav",
        "attack": "attack.wav",
        "special_attack": "special_attack.wav",
        "hit": "hit.wav",
        "block": "block.wav",
        "level_up": "level_up.wav",
        "item_pickup": "item_pickup.wav",
        "game_over": "game_over.wav",
        "background": "background_music.mp3",
        "boss_music": "boss_music.mp3"
    }
    
    for name, file in sound_files.items():
        try:
            path = os.path.join(ASSETS_PATH, file)
            sounds[name] = pygame.mixer.Sound(path)
        except Exception as e:
            print(f"Couldn't load sound: {file} - {e}")
            sounds[name] = None
    
    return sounds

def draw_ui(screen, score, player_health, font, player):
    # Draw top panel
    panel_height = 40
    pygame.draw.rect(screen, (50, 50, 50), (0, 0, WIDTH, panel_height))
    
    # Score (only in UI, not in debug)
    score_text = font.render(f"Score: {score}", True, WHITE)
    screen.blit(score_text, (20, panel_height // 2 - score_text.get_height() // 2))
    
    # Player health
    health_width = 150
    health_height = 15
    health_x = WIDTH - health_width - 20
    health_y = panel_height // 2 - health_height // 2
    
    # Health bar background
    pygame.draw.rect(screen, (100, 100, 100), (health_x, health_y, health_width, health_height))
    # Health bar
    health_ratio = player_health / PLAYER_MAX_HEALTH
    pygame.draw.rect(screen, (200, 50, 50), 
                    (health_x, health_y, int(health_width * health_ratio), health_height))
                    
    # Invisibility cooldown
    if player.invisibility_cooldown > 0:
        cooldown_text = font.render(f"Invisibility: {int(player.invisibility_cooldown)}s", True, WHITE)
        screen.blit(cooldown_text, (WIDTH // 2 - cooldown_text.get_width() // 2, panel_height // 2 - cooldown_text.get_height() // 2))

def save_highscore(score):
    try:
        with open(os.path.join(BASE_DIR, "highscore.json"), "w") as f:
            json.dump({"highscore": score}, f)
    except Exception as e:
        print(f"Error saving highscore: {e}")

def load_highscore():
    try:
        with open(os.path.join(BASE_DIR, "highscore.json"), "r") as f:
            data = json.load(f)
            return data.get("highscore", 0)
    except:
        return 0

def draw_shadow(surface, entity):
    shadow = pygame.Surface((entity.rect.width * 0.8, entity.rect.height * 0.2), pygame.SRCALPHA)
    shadow.fill((0, 0, 0, 100))
    shadow_rect = shadow.get_rect(midbottom=entity.rect.midbottom)
    shadow_rect.y += 5  # Small offset down
    surface.blit(shadow, shadow_rect)

async def main():
    # Initialize pygame
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption(TITLE)
    clock = pygame.time.Clock()
    
    while True:  # Main game loop
        try:
            # Initialize game objects
            bg = Background()
            player = Player(PLAYER_START_X, GROUND_LEVEL)
            enemies = pygame.sprite.Group()
            all_sprites = pygame.sprite.Group(player)
            
            # Game variables
            enemy_spawn_timer = 0
            score = 0
            highscore = load_highscore()
            font = pygame.font.SysFont("Arial", 24)
            debug_font = pygame.font.SysFont("Arial", 16)
            
            # Game state
            running = True
            game_active = False
            
            while running:
                try:
                    dt = clock.tick(FPS) / 1000
                    
                    # Event handling
                    for event in pygame.event.get():
                        if event.type == pygame.QUIT:
                            pygame.quit()
                            sys.exit()
                        
                        if game_active:
                            if event.type == pygame.KEYDOWN:
                                if event.key == pygame.K_SPACE:
                                    player.jump()
                                elif event.key == pygame.K_f:
                                    player.attack()
                                elif event.key == pygame.K_e:
                                    player.special_attack()
                                elif event.key == pygame.K_q:
                                    player.block()
                                elif event.key == pygame.K_DOWN:
                                    player.toggle_hide()
                        else:
                            if event.type == pygame.KEYDOWN:
                                if event.key == pygame.K_RETURN and not game_active and score == 0:
                                    game_active = True
                                elif event.key == pygame.K_r and not game_active and score > 0:
                                    game_active = True
                                    player = Player(PLAYER_START_X, GROUND_LEVEL)
                                    enemies.empty()
                                    all_sprites = pygame.sprite.Group(player)
                                    score = 0
                                    player.health = PLAYER_MAX_HEALTH
                    
                    if game_active:
                        # Spawn enemies
                        enemy_spawn_timer += dt * 1000
                        if enemy_spawn_timer >= ENEMY_SPAWN_RATE and len(enemies) < MAX_ENEMIES:
                            enemy_type = random.choice(list(ENEMY_HEALTH.keys()))
                            enemy = Enemy(enemy_type)
                            enemies.add(enemy)
                            all_sprites.add(enemy)
                            enemy_spawn_timer = 0
                        
                        # Update game objects
                        bg.update(score)
                        player.update(pygame.key.get_pressed())
                        enemies.update()
                        
                        # Remove off-screen enemies
                        for enemy in list(enemies):
                            if enemy.off_screen:
                                enemy.kill()
                        
                        # Handle attacks
                        if player.attacking:
                            for enemy in enemies:
                                if player.attack_rect.colliderect(enemy.rect) and not enemy.was_hit:
                                    enemy.was_hit = True
                                    if enemy.take_damage():
                                        enemy.kill()
                                        score += 100
                        else:
                            for enemy in enemies:
                                enemy.was_hit = False
                        
                        # Check for collisions
                        if not player.hidden and pygame.sprite.spritecollide(player, enemies, False):
                            game_active = False
                            if score > highscore:
                                highscore = score
                                save_highscore(highscore)
                        
                        # Increment score
                        score += 1
                        
                        # Draw everything
                        screen.fill(BLACK)
                        bg.draw(screen)
                        
                        # Draw shadows
                        draw_shadow(screen, player)
                        for enemy in enemies:
                            draw_shadow(screen, enemy)
                        
                        # Draw sprites
                        player.draw(screen)
                        for enemy in enemies:
                            enemy.draw(screen)
                        
                        # Draw UI
                        draw_ui(screen, score, player.health, font, player)
                        
                        # Debug info
                        if DEBUG_MODE:
                            theme_names = ["Normal", "Night", "Sunset", "Morning"]
                            debug_text = [
                                f"Highscore: {highscore}",
                                f"Enemies: {len(enemies)}",
                                f"Player state: {player.current_state}",
                                f"Position: {player.rect.topleft}",
                                f"Velocity: ({player.velocity_x:.1f}, {player.velocity_y:.1f})",
                                f"Invisibility: {int(player.invisibility_timer if player.hidden else player.invisibility_cooldown)}s",
                                f"Jumping: {player.jumping}",
                                f"On ground: {player.on_ground}",
                                f"Background theme: {theme_names[bg.current_theme]}"
                            ]
                            
                            for i, text in enumerate(debug_text):
                                text_surface = debug_font.render(text, True, WHITE)
                                screen.blit(text_surface, (10, 50 + i * 20))
                            
                            pygame.draw.rect(screen, DEBUG_RED, player.rect, 1)
                            if player.attacking:
                                pygame.draw.rect(screen, DEBUG_RED, player.attack_rect, 1)
                            for enemy in enemies:
                                pygame.draw.rect(screen, DEBUG_RED, enemy.rect, 1)
                    else:
                        screen.fill(BLACK)
                        if score == 0:
                            show_menu(screen)
                        else:
                            if show_game_over(screen):
                                break
                    
                    pygame.display.flip()
                    await asyncio.sleep(0)
                    
                except Exception as e:
                    print(f"Error in game loop: {e}")
                    continue
                    
        except Exception as e:
            print(f"Error in main loop: {e}")
            continue
        
        if not running:
            break

if __name__ == "__main__":
    asyncio.run(main())
