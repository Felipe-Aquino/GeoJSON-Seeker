#include <stdio.h>
#include <stdlib.h>

#define NATIVE
#include "hough.c"

int main() {
    int width = 12, height = 12;
    unsigned char pixels[576] = {0};

    for (int i = 0; i < width; ++i) {
        for (int j = 0; j < height; ++j) {
            int p = 4 * (j * width + i);
            pixels[p + 0] = 0xff;
            pixels[p + 1] = 0xff;
            pixels[p + 2] = 0xff;
            pixels[p + 3] = 0xff;

            if (i > 0 && j > 0 && i < width - 1 && j < height - 1) {
                if (i == j || i == 1 || j == 1 || i == width - 2 || j == height - 2) {
                    pixels[p + 0] = 0;
                    pixels[p + 1] = 0;
                    pixels[p + 2] = 0;
                }
            }
        }
    }

    for (int i = 0; i < width; ++i) {
        for (int j = 0; j < height; ++j) {
            int p = 4 * (j * width + i);
            // printf("(%d, %d) ", (int)pixels[p], (int)pixels[p + 3]);
            printf("%02x ", (int)pixels[p]);
        }
        printf("\n");
    }
    printf("\n");

    Points *pts = points_of_interest(pixels, width, height);

    width -= 2;
    height -= 2;

    for (int i = 0; i < width; ++i) {
        for (int j = 0; j < height; ++j) {
            int p = 4 * (j * width + i);
            printf("%02x ", (int)pixels[p]);
        }
        printf("\n");
    }
    printf("\n");

    printf("size: %d, cap: %d\n", pts->size, pts->capacity);
    for (int i = 0; i < pts->size; ++i) {
        Point pt = pts->data[i];

        printf("(%f, %f): %.2f!\n", pt.x, pt.y, pt.tag);
    }

    free(pts->data);
    free(pts);

    return 0;
}
