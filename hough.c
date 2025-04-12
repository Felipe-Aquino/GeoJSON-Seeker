#ifdef NATIVE
#include <stdio.h>
#include <math.h>

#define alloc malloc

#define DA_START_CAPACITY 3000

#define MIN_DIST2 2


#else
#define sqrtf __builtin_sqrtf

float sinf(float);
float cosf(float);

void console_log(char *ptr, int len);

extern unsigned char __heap_base;
unsigned bump_pointer = (unsigned)(void *)&__heap_base;

void *alloc(int n) {
    n += (4 - n % 4) % 4;

    unsigned r = bump_pointer;
    bump_pointer += n;
    return (void *)r;
}

void free_all() {
    bump_pointer = (unsigned)(void *)&__heap_base;
}

#define DA_START_CAPACITY 2048

#ifdef TEST
#define MIN_DIST2 2
#else
#define MIN_DIST2 144
#endif

#include "buffer.c"

#define printf(...)                        \
    do {                                        \
        buffer_format(__VA_ARGS__);        \
        console_log(buffer.data, buffer.size);  \
        buffer.size = 0;                        \
    } while (0)

#endif


#define PI 3.1415926f

#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

// Linear apend
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

typedef unsigned char uchar;
typedef unsigned int uint;

typedef struct Point {
    int x, y;
    int tag;
} Point;

typedef struct Points {
    int capacity;
    int size;
    Point *data;
} Points;

typedef struct Vec2f {
    float x, y;
} Vec2f;

typedef struct Vec2i {
    int x, y;
} Vec2i;

typedef struct Color {
    uchar r, g, b, a;
} Color;

typedef struct BucketInfo {
    int pos, count;
} BucketInfo;

typedef struct Bounds {
    int min_x, min_y, max_x, max_y;
} Bounds;

typedef struct Result {
    int pixels_size;
    uchar *pixels;
    int width;
    int height;

    Vec2i offset;
    Points points;
} Result;

int point_dist2(Point p1, Point p2) {
    int dx = p2.x - p1.x;
    int dy = p2.y - p1.y;
    return dx * dx + dy * dy;
}

void crop_image_in_place(uchar *pixels, int width, int height, int x, int y, int dw, int dh) {
    dw = MIN(width, dw);
    dh = MIN(height, dh);

    int start = 0;

    for (int y0 = y; y0 < y + dh; y0 += 1) {
        const int r = y0 * width;

        for (int x0 = x; x0 < x + dw; x0 += 1) {
            int pos = 4 * (r + x0);

            *(int *)(pixels + start) = *(int *)(pixels + pos);

            start += 4;
        }
    }
}

#define IS_AROUND(x, value, p) \
    (((1 - p) * (float)(value) <= (float)(x)) && ((float)(x) <= (1 + p) * (float)(value)))

int test_color(Color c) {
    const float v = 0.1;

    const Color ref =
#ifndef TEST
    { 0xea, 0x43, 0x35, 0xff };
#else
    { 0x00, 0x00, 0x00, 0xff };
#endif

    return IS_AROUND(c.r, ref.r, v) && IS_AROUND(c.g, ref.g, v) && IS_AROUND(c.b, ref.b, v);
}

#undef IS_AROUND

Bounds get_area_bounds(uchar *pixels, int width, int height) {
    Bounds bounds = {
        .min_x = width,
        .min_y = height,
        .max_x = 0,
        .max_y = 0
    };

    uint num_pixels = width * height;
    Color *color_pixels = (Color *) pixels;

    for (uint i = 0; i < num_pixels; ++i) {
        if (test_color(color_pixels[i])) {
            const int x = i % width;
            const int y = i / width;

            if (x < bounds.min_x) {
                bounds.min_x = x;
            }

            if (x > bounds.max_x) {
                bounds.max_x = x;
            }

            if (y < bounds.min_y) {
                bounds.min_y = y;
            }

            if (y > bounds.max_y) {
                bounds.max_y = y;
            }
        }
    }

    return bounds;
}

#define RADIUS_STEP 4
#define ANGLES_DIVISION_COUNT 50

Result *points_of_interest(uchar *pixels, int width, int height) {
    Bounds bounds = get_area_bounds(pixels, width, height);

    const int pad =
#ifndef TEST 
        40;
#else
         0;
#endif

    const int dw = MIN(bounds.max_x - bounds.min_x + 1 + 2 * pad, width - bounds.min_x);
    const int dh = MIN(bounds.max_y - bounds.min_y + 1 + 2 * pad, height - bounds.min_y);

    Vec2i offset = {
        .x = MAX(bounds.min_x - pad, 0),
        .y = MAX(bounds.min_y - pad, 0),
    };

    crop_image_in_place(pixels, width, height, offset.x, offset.y, dw, dh);

    width = dw;
    height = dh;

    const int diagonal_length =
        sqrtf(width * width + height * height);

    const int radius_division_count = 1 + diagonal_length / RADIUS_STEP;

    int buckets_size = (ANGLES_DIVISION_COUNT + 1) * (radius_division_count + 1);
    int *buckets = alloc(sizeof(int) * buckets_size);

    const float angles_step = PI / (float)ANGLES_DIVISION_COUNT;
    Vec2f angles[ANGLES_DIVISION_COUNT];

    float theta = 0.0f;
    for (int i = 0; i < ANGLES_DIVISION_COUNT; ++i) {
        angles[i] = (Vec2f){ cosf(theta), sinf(theta) };
        theta += angles_step;
    }

    Points points = {0, 0, 0};

    const int num_pixels = width * height;
    Color *color_pixels = (Color *) pixels;

    for (int i = 0; i < num_pixels; ++i) {
        if (test_color(color_pixels[i])) {
            int row = i / width;
            int col = i % width;

            for (int ang_idx = 0; ang_idx < ANGLES_DIVISION_COUNT; ang_idx += 1) {
                float r = col * angles[ang_idx].x + row * angles[ang_idx].y;

                if (r > 0) {
                    int rad_idx = r / RADIUS_STEP;
                    int pos = ang_idx + rad_idx * ANGLES_DIVISION_COUNT;

                    buckets[pos] += 1;

                    Point p = { col, row, pos };
                    da_append(&points, p);
                }
            }
        }
    }

    float percentile = 0.9;
    int top_buckets_size = (int)((float)buckets_size * (1 - percentile));
    BucketInfo *top_buckets = alloc(sizeof(BucketInfo) * top_buckets_size);

    for (int i = 0; i < top_buckets_size; ++i) {
        top_buckets[i] = (BucketInfo) { -1, 0 };
    }

    for (int i = 0; i < buckets_size; ++i) {
        int count = buckets[i];
        
        for (int j = 0; j < top_buckets_size; ++j) {
            if (count > top_buckets[j].count) {
                for (int k = top_buckets_size - 1; k > j; --k) {
                    top_buckets[k] = top_buckets[k - 1];
                }

                top_buckets[j] = (BucketInfo) { i, count };

                break;
            }
        }
    }

    // Sieving points

    int k = 0;

    for (int i = 0; i < points.size; ++i) {
        Point p = points.data[i];

        for (int j = 0; j < top_buckets_size; ++j) {
            if (p.tag == top_buckets[j].pos) {
                int collision = 0;

                for (int l = k - 1; l >= 0; --l) {
                    if (point_dist2(p, points.data[l]) < MIN_DIST2) {
                        collision = 1;
                        break;
                    }
                }

                if (collision == 0) {
                    points.data[i] = points.data[k];
                    points.data[k] = p;
                    k += 1;
                    break;
                }
            }
        }
    }

    points.size = k;

#ifdef NATIVE
    free(buckets);
    free(top_buckets);
#endif

    Result *result = alloc(sizeof(Result));

    *result = (Result) {
        .pixels_size = 4 * num_pixels,
        .pixels = pixels,
        .width = width,
        .height = height,
        .offset = offset,

        .points = points,
    };

    return result;
}
