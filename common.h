#ifndef _COMMON_H_
#define _COMMON_H_

#include <stdbool.h>

#define NULL (void*)0

// Dynamic Array
#define DA_START_CAPACITY 2048

void *alloc(int n);
void reset_last_alloc(void *ptr);

// Linear append
#define da_append(arr, value)                                            \
    do {                                                                 \
        if ((arr)->capacity == 0) {                                      \
            (arr)->size = 1;                                             \
            (arr)->capacity = DA_START_CAPACITY;                         \
                                                                         \
            (arr)->data = alloc((arr)->capacity * sizeof(value));        \
        } else {                                                         \
            (arr)->size += 1;                                            \
                                                                         \
            if ((arr)->size >= (arr)->capacity) {                        \
                int new_capacity = (int) (1.5 * (float)(arr)->capacity); \
                alloc((new_capacity - (arr)->capacity) * sizeof(value)); \
                (arr)->capacity = new_capacity;                          \
            }                                                            \
        }                                                                \
                                                                         \
        (arr)->data[(arr)->size - 1] = (value);                          \
    } while (0)

#define da_swap(arr, i, j)                         \
    do {                                           \
        typeof(*(arr)->data) aux = (arr)->data[i]; \
        (arr)->data[i] = (arr)->data[j];           \
        (arr)->data[j] = aux;                      \
    } while (0)

#define da_swap_remove(arr, at)                           \
    do {                                                  \
        if (at < (arr)->size) {                           \
          typeof(*(arr)->data) aux = (arr)->data[at];     \
          (arr)->data[at] = (arr)->data[(arr)->size - 1]; \
          (arr)->data[(arr)->size - 1] = aux;             \
          (arr)->size -= 1;                               \
        }                                                 \
    } while (0)

// Math

#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

#define PI 3.1415926f

#define sqrtf __builtin_sqrtf

float sinf(float);
float cosf(float);
float atanf(float);

typedef unsigned char uchar;
typedef unsigned int uint;

typedef struct Color {
    uchar r, g, b, a;
} Color;

typedef struct Image {
    uint width;
    uint height;
    Color *pixels;
} Image;

typedef struct Vec2i {
    int x, y;
} Vec2i;

typedef struct Vec2f {
    float x, y;
} Vec2f;

typedef struct Points {
    int capacity;
    int size;
    Vec2i *data;
} Points;

typedef struct Result {
    int pixels_size;
    uchar *pixels;
    int width;
    int height;

    Vec2i offset;
    Points points;
} Result;

int v2i_dist2(Vec2i p1, Vec2i p2) {
    int dx = p2.x - p1.x;
    int dy = p2.y - p1.y;
    return dx * dx + dy * dy;
}

bool v2i_equal(Vec2i p1, Vec2i p2) {
    return p1.x == p2.x && p1.y == p2.y;
}

Vec2i v2i_sub(Vec2i p1, Vec2i p2) {
    return (Vec2i) { p1.x - p2.x, p1.y - p2.y };
}

float v2i_angle_y_inverted(Vec2i p1, Vec2i p2) {
    float ang = atanf(-(float)(p2.y - p1.y) / (float)(p2.x - p1.x));
    if (ang >= 0) {
        if (p2.x >= p1.x) {
            return ang;
        } else {
            return ang + PI;
        }
    } else {
        if (p2.x < p1.x) {
            return ang + PI;
        } else {
            return ang + 2 * PI;
        }
    }
}

#endif // _COMMON_H_
