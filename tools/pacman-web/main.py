"""Browser entry point for the 42 Pac-Man, built with pygbag.

The game code is copied unchanged from quarantadue/milestone_4/PAC-MAN.
Only two things differ from the desktop build: the window is the page
canvas, and the main loop yields to the browser every frame.
"""

import asyncio
import time

import pygame

from pacman import gfx


def _window(self, width, height, title):
    pygame.display.init()
    pygame.font.init()
    self.screen = pygame.display.set_mode((width, height))
    self.width, self.height = width, height
    pygame.key.set_repeat(250, 60)
    self._fonts = {}


gfx.Window.__init__ = _window
gfx.Window.present = lambda self: pygame.display.flip()
gfx.screen_size = lambda: (1260, 900)

from pacman.app import App  # noqa: E402  (after the gfx patch)
from pacman.config import load_config  # noqa: E402


async def main():
    app = App(load_config("config.json"))
    last = time.monotonic()
    while True:
        now = time.monotonic()
        app.dt = min(now - last, 0.05)
        last = now
        app.clock += app.dt
        for key, char in app.win.events():
            app.on_key(key, char)
        if not app.running:  # "Quit" has nowhere to go in a page
            app.running = True
            app.go("menu")
        app.update(app.dt)
        app.draw()
        app.win.present()
        app._prewarm(now)
        await asyncio.sleep(0)


asyncio.run(main())
