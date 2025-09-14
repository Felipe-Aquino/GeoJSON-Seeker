#include "common.h"
#include "sort.c"

#define NAN (__builtin_nanf (""))
#define isnan(x) __builtin_isnan (x)

// #define NAN 10000000.f
// #define isnan(x) x == NAN

float fmodf(float a, float b) {
    int q = (int)(a / b);
    return a - b * (float)q;
}

typedef struct Neighbor {
    Vec2i point;
    int idx;
} Neighbor;

#define MAX_NEIGHBORS 12

typedef struct Neighbors {
    Neighbor data[MAX_NEIGHBORS];
    int size;
} Neighbors;

int find_max_y_point_idx(Points points) {
    int max_y = points.data[0].y;
    int idx = 0;

    for (int i = 1; i < points.size; ++i) {
        if (points.data[i].y > max_y) {
            max_y = points.data[i].y;
            idx = i;
        }
    }

    return idx;
}

void find_k_nearest_neighbors(Neighbors *result, Points points, Vec2i current_point, int k) {
    int n = points.size;

    result->size = 0;

    int max_dist = 0;
    int max_dist_idx = -1;

    for (int i = 0; i < n; ++i) {
        int dist = v2i_dist2(current_point, points.data[i]);

        if (dist < max_dist || result->size != k) {
            if (result->size == k) {
                result->data[max_dist_idx] = (Neighbor) {
                    .point = points.data[i],
                    .idx = i,
                };
            } else {
                result->data[result->size] = (Neighbor) {
                    .point = points.data[i],
                    .idx = i,
                };

                result->size += 1;
            }

            max_dist = 0;

            for (int j = 0; j < result->size; ++j) {
                int d = v2i_dist2(current_point, result->data[j].point);

                if (max_dist < d) {
                    max_dist = d;
                    max_dist_idx = j;
                }
            }
        }
    }
}

Vec2f solve_Ax_b_equation(Vec2i col1, Vec2i col2, Vec2i b) {
    // A = [col1 col2] = [col1.x  col2.x]
    //                   [col1.y  col2.y]
    // b = [x]
    //     [y]

    float det = (float)(col1.x * col2.y - col2.x * col1.y);

    if (det == 0.f) {
        return (Vec2f) { NAN, NAN };
    }

    Vec2f u = {
        .x = (float)( col2.y * b.x - col2.x * b.y) / det,
        .y = (float)(-col1.y * b.x + col1.x * b.y) / det,
    };

    return u;
}

bool intersects(Vec2i p1, Vec2i p2, Vec2i p3, Vec2i p4) {
    Vec2f r = solve_Ax_b_equation(
        v2i_sub(p2, p1),
        v2i_sub(p3, p4),
        v2i_sub(p3, p1)
    );

    if (isnan(r.x)) {
        return false;
    }

    float u = r.x;
    float v = r.y;

    return 0 < u && u <= 1 && 0 < v && v <= 1;
}

bool point_in_polygon(Points polygon, Vec2i point) {
    bool is_inside = false;

    for (int i = 0; i < polygon.size - 1; i += 1) {
        Vec2i p1 = polygon.data[i];
        Vec2i p2 = polygon.data[i + 1];

        const int min_y = MIN(p1.y, p2.y);
        const int max_y = MAX(p1.y, p2.y);

        if (v2i_equal(point, p1) || v2i_equal(point, p2)) {
            is_inside = true;
            break;
        }

        if (min_y <= point.y && point.y <= max_y && min_y != max_y) {
            const int max_x = MAX(p1.x, p2.x);

            if (point.x < max_x) {
                if (p1.x == p2.x) {
                    is_inside = !is_inside;

                    if (point.y == p1.y) {
                      is_inside = !is_inside;
                    }
                } else {
                    float x_ray_intersection =
                        (float)((point.y - p1.y) * (p2.x - p1.x)) / (float)(p2.y - p1.y) +
                        (float)p1.x; 

                    if (x_ray_intersection > (float)point.x) {
                        is_inside = !is_inside;

                        if (x_ray_intersection == p1.x) {
                            int i0 = (i + polygon.size - 1) % polygon.size;
                            Vec2i p0 = polygon.data[i0];

                            if ((p2.y < point.y && p0.y >= point.y) ||
                                (p0.y < point.y && p2.y >= point.y)) {
                                is_inside = !is_inside;
                            }
                        }
                    }
                }
            }
        }
    }

    return is_inside;
}

typedef struct NeighborCmpData {
    float prev_angle;
    Vec2i current_point;
} NeighborCmpData;

int neighbor_compare(void *arr, int i, int j, void *data) {
    NeighborCmpData *ncd = (NeighborCmpData *)data;
    float prev_angle = ncd->prev_angle;
    Vec2i current_point = ncd->current_point;

    Neighbors *neighbors = (Neighbors *)arr;

    Vec2i p1 = neighbors->data[i].point;
    Vec2i p2 = neighbors->data[j].point;

    // fmod not always loop around, so this e factor almost asures that
    float e = 1e-12;
    float factor = 2 * PI - prev_angle + e;

    float ang1 = fmodf((v2i_angle_y_inverted(current_point, p1) + factor), (2 * PI));
    float ang2 = fmodf((v2i_angle_y_inverted(current_point, p2) + factor), (2 * PI));

    if (ang1 == ang2) {
        int d1 = v2i_dist2(current_point, p1);
        int d2 = v2i_dist2(current_point, p2);

        return d1 - d2;
    }

    return ang2 > ang1 ? 1 : -1;
}

Points concave_hull(Points points, int k) {
    int n = points.size;

    if (k > MAX_NEIGHBORS || k > n) {
        return (Points) { 0, 0, 0 };
    }

    if (n < 3 || n == 3) {
        // TODO: See what should happen
        return points;
    }

    k = MIN(MAX(k, 3), n - 1);

    int idx = find_max_y_point_idx(points);
    Vec2i first_point = points.data[idx];
    Vec2i current_point = first_point;

    da_swap_remove(&points, idx);

    Points hull = {0};
    da_append(&hull, first_point);

    Neighbors neighbors;
    neighbors.size = 0;

    float prev_angle = 0;
    int step = 1;

    while (points.size > 0) {
        if (step == 4) {
            // The first point is at the end of the array, we are bringing it back
            da_swap(&points, n - 1, points.size);
            points.size += 1;
        }

        find_k_nearest_neighbors(&neighbors, points, current_point, k);

        NeighborCmpData ncd = { prev_angle, current_point };

        // Bubble sort must good enough for small sets, right?
        bubble_sort(
            neighbors.data,
            neighbors.size,
            sizeof(Neighbor),
            neighbor_compare,
            &ncd
        );

        bool all_intersects = false;
        int i = 0;

        for (; i < neighbors.size; ++i) {
            const int last_point = v2i_equal(neighbors.data[i].point, first_point)
                ? 1
                : 0;

            all_intersects = false;

            for (int j = 1; j < hull.size - last_point; ++j) {
                all_intersects = intersects(
                    hull.data[step - 1],
                    neighbors.data[i].point,
                    hull.data[step - 1 - j],
                    hull.data[step - j]
                );

                if (all_intersects) {
                    break;
                }
            }

            if (!all_intersects) {
                break;
            }
        }

        if (all_intersects) {
            // NOTE: This can be freed because it was the last memory alloc'ed
            reset_last_alloc(hull.data);
            return (Points) { 0, 0, 0 };
        }

        current_point = neighbors.data[i].point;
        da_append(&hull, current_point);

        prev_angle = v2i_angle_y_inverted(hull.data[step], hull.data[step - 1]);
        da_swap_remove(&points, neighbors.data[i].idx);

        if (v2i_equal(first_point, current_point)) {
            break;
        }

        step += 1;
    }

    for (int j = points.size - 1; j >= 0; --j) {
        if (!point_in_polygon(hull, points.data[j])) {
            // NOTE: This can be freed because it was the last memory alloc'ed
            reset_last_alloc(hull.data);
            return (Points) { 0, 0, 0 };
        }
    }

    return hull;
}
