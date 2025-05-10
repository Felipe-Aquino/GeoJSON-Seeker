#include <stdio.h>
#include <string.h>

#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

// The assets occupy around 20KB
#define PAGE_SIZE (64 * 1024)

typedef struct Page {
    size_t size;
    unsigned char data[PAGE_SIZE];
} Page;

int main() {
    printf("// File genereted by gen_assets.c\n\n");

    printf("typedef struct Asset {\n");
    printf("    const char *filepath;\n");
    printf("    int offset;\n");
    printf("    int width;\n");
    printf("    int height;\n");
    printf("} Asset;\n\n");

    const char *assets[] = {
        "assets/broom2_white_32px.png",
        "assets/clipboard_white_32px.png",
        "assets/pin2_white_32px.png",
        "assets/route_white_32px.png",
    };

    Page content = {0};

    const int len = sizeof(assets) / sizeof(assets[0]);

    printf("Asset assets[] = {\n");
    for (int i = 0; i < len; ++i) {
        const char *file = assets[i];

        int w, h, channels_count = 4;

        stbi_uc *pixels = stbi_load(file, &w, &h, NULL, channels_count);

        printf("    {\"%s\", %zu, %d, %d},\n", file, content.size, w, h);

        size_t size = w * h * channels_count;

        for (size_t j = 0; j < size; j += 4) {
            unsigned char c = pixels[j + 3];
            content.data[content.size] = c;
            content.size += 1;
        }

        stbi_image_free(pixels);
    }
    printf("};\n\n");

    printf("char assets_data[] = {");
    for (size_t i = 0; i < content.size; ++i) {
        printf("%u,", content.data[i]);
    }
    printf("};\n");

    return 0;
}
