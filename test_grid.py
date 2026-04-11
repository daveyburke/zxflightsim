import cv2
import numpy as np

img = cv2.imread('public/assets/zx-keyboard.jpg')
h, w, _ = img.shape

# Let's draw a standard 10x4 grid
cols = 10
rows = 4

for r in range(1, rows):
    y = int(r * h / rows)
    cv2.line(img, (0, y), (w, y), (0, 255, 0), 2)

for c in range(1, cols):
    x = int(c * w / cols)
    cv2.line(img, (x, 0), (x, h), (0, 0, 255), 2)

cv2.imwrite('/Users/daveburke/.gemini/antigravity/brain/7f74da89-47aa-43d9-b103-48f98399fa2d/scratch/grid_test.jpg', img)
print(f"Dimensions: {w}x{h}")
