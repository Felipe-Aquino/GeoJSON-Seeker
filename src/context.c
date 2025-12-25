void load_map();

void geojson_to_clipboard(
    Vec2i *points_ptr, int points_len,
    int offset_x, int offset_y
);

typedef struct Result {
    int pixels_size;
    uchar *pixels;
    int width;
    int height;

    Vec2i offset;
    Points points;
} Result;

typedef struct Context {
    Result *result;
    Points path;

    bool is_website_supported;

    bool canvas_loaded;
    bool loading;
    float loader_offset;

    int scroll_offset_x;
    int scroll_offset_y;

    bool show_buttons;

    bool marking_points;
    bool removing_points;
} Context;

Context ctx;

void set_is_website_supported(bool value) {
    ctx.is_website_supported = value;
    ctx.loading = value;
}

void set_is_loading(bool value) {
    ctx.loading = value;
}

void set_mouse_position(float x, float y) {
    ui_set_mouse_position(x, y);
}

void set_mouse_pressed(bool p) {
    ui_set_mouse_pressed(p);

    if (ui.hot_id != -1 || ui.last_hot_id != -1) {
        return;
    }

    if (p && ctx.result) {
        if (ctx.marking_points) {
            Vec2i pt = {
                ctx.scroll_offset_x + ui.mouse_x,
                ctx.scroll_offset_y + ui.mouse_y,
            };

            bool exists = false;

            for (int i = 0; i < ctx.result->points.size; ++i) {
                if (v2i_dist2(pt, ctx.result->points.data[i]) <= 25) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                da_append(&ctx.result->points, pt);
            }
        }

        if (ctx.removing_points) {
            Vec2i pt = {
                ctx.scroll_offset_x + ui.mouse_x,
                ctx.scroll_offset_y + ui.mouse_y,
            };

            for (int i = 0; i < ctx.result->points.size; ++i) {
                if (v2i_dist2(pt, ctx.result->points.data[i]) <= 25) {
                    da_swap_remove(&ctx.result->points, i);
                    break;
                }
            }
        }
    }
}

void set_mouse_wheel(float dx, float dy) {
    ui_set_mouse_wheel(dx, dy);
}

enum AssetEnum {
    BROOM = 0,
    CLIPBOARD,
    PIN,
    ROUTE,
    ASSET_COUNT,
};

Image asset_images[ASSET_COUNT] = {};

Image expand_asset_img(Asset *asset) {
    char *data = &assets_data[asset->offset];

    const int asset_size = asset->width * asset->height;
    const int total_pixels = asset_size * 4;

    Image img = {
        .width = asset->width,
        .height = asset->height,
        .pixels = alloc(total_pixels),
    };

    for (int i = 0; i < asset_size; i += 1) {
        img.pixels[i] = (Color) { 255, 255, 255, data[i] };
    }

    return img;
}

void init() {
    ctx = (Context) {
        .result = NULL,

        .is_website_supported = true,

        .canvas_loaded = false,
        .loading = true,
        .loader_offset = 0.f,

        .scroll_offset_x = 0,
        .scroll_offset_y = 0,

        .show_buttons = true,

        .marking_points = false,
        .removing_points = false,
    };

    for (int i = 0; i < ASSET_COUNT; ++i) {
        asset_images[i] = expand_asset_img(&assets[i]);
    }
}

void set_process_result(Result *result) {
    ctx.result = result;
    ctx.loading = false;
    ctx.canvas_loaded = true;
}

void loader(float delta_time, int x, int y, int gap, float r1, float r2);
Points connect_points(Points points);

void update(float dt, float width, float height) {
    c2d_set_fill_color(230, 230, 230, 255);
    c2d_fill_quad(0, 0, width, height);

    if (!ctx.is_website_supported) {
        const char *msg = _TR(NOT_SUPPORTED);

        c2d_set_fill_color(0, 0, 0, 255);
        int w = c2d_text_width2(msg, 20);
        c2d_fill_text2(msg, (width - w) / 2, (height - 10) / 2, 20);

        return;
    }

    if (ctx.result) {
        c2d_image_a(
            ctx.result->pixels,
            ctx.scroll_offset_x,
            ctx.scroll_offset_y,
            0,
            0,
            ctx.result->width,
            ctx.result->height
        );


        c2d_set_stroke_color(0x26, 0x35, 0xd7, 0xff);

        if (ctx.path.size) {
            Vec2i offset = { ctx.scroll_offset_x, ctx.scroll_offset_y };
            for (int i = 0; i < ctx.path.size - 1; ++i) {
                Vec2i p1 = v2i_sub(ctx.path.data[i], offset);
                Vec2i p2 = v2i_sub(ctx.path.data[i + 1], offset);

                c2d_line(p1.x, p1.y, p2.x, p2.y, 3);
            }
        } else {
            for (int i = 0; i < ctx.result->points.size; ++i) {
                Vec2i p = ctx.result->points.data[i];

                c2d_circle(p.x - ctx.scroll_offset_x, p.y - ctx.scroll_offset_y, 5, 2);
            }
        }
    }

    if (ctx.loading) {
        loader(dt, width / 2, height / 2, 5, 50.f, 5.f);

        const char *msg = _TR(LOADING_MAP);

        c2d_set_fill_color(0, 0, 0, 255);
        int w = c2d_text_width2(msg, 20);
        c2d_fill_text2(msg, (width - w) / 2, 85 + height / 2, 20);
    }

    int x = 10;
    int y = 10;

    if (ctx.show_buttons && ctx.canvas_loaded && !ctx.loading) {
        if (icon_button(asset_images[PIN], _TR(ADD_POINTS), x, y, ctx.marking_points)) {
            reset_last_alloc(ctx.path.data);
            ctx.path = (Points) { 0, 0, NULL };

            ctx.marking_points = !ctx.marking_points;
            ctx.removing_points = false;
        }

        y += 50;
        if (icon_button(asset_images[BROOM], _TR(REMOVE_POINTS), x, y, ctx.removing_points)) {
            reset_last_alloc(ctx.path.data);
            ctx.path = (Points) { 0, 0, NULL };

            ctx.marking_points = false;
            ctx.removing_points = !ctx.removing_points;
        }

        y += 50;
        if (icon_button(asset_images[ROUTE], _TR(CONNECT_POINTS), x, y, false)) {
            bool ok = !!ctx.result && !(ctx.marking_points || ctx.removing_points);

            if (ok && ctx.path.size == 0) {
                ctx.path = connect_points(ctx.result->points);
            } else if (ctx.path.size > 0) {
                reset_last_alloc(ctx.path.data);
            }
        }

        y += 50;
        if (
            ctx.path.size > 0 &&
            icon_button(asset_images[CLIPBOARD], _TR(COPY), x, y, false)
        ) {
            geojson_to_clipboard(
                ctx.path.data, ctx.path.size,
                ctx.result->offset.x, ctx.result->offset.y
            );
        }
    }

    bool editing = ctx.marking_points || ctx.removing_points;

    x = 2;
    y = (height - 40) / 2;

    if (ctx.canvas_loaded && show_hide_button(x, y, !ctx.show_buttons)) {
        ctx.show_buttons = !ctx.show_buttons;
    }

    if (ctx.result) {
        ctx.scroll_offset_y = vscrolbar(width, height, (float)ctx.result->height);
        ctx.scroll_offset_x = hscrolbar(height, width, (float)ctx.result->width);
    }

    ui_reset();
}

void loader(float delta_time, int x, int y, int gap, float r1, float r2) { 
    float k = r2 / (2.f * r1);
    float theta = atanf(2 * k * sqrtf(1 - k * k) / (1 - 2 * k * k));
    int n = 2 * PI * r1 / (theta * r1 + gap);

    for (int i = 0; i < n; ++i) {
        float ang = 2 * PI * i / n;
        float x1 = x + r1 * cosf(ang) + r1 * sinf(ang);
        float y1 = y + r1 * cosf(ang) - r1 * sinf(ang);

        int alfa = 255 - ((int)(ctx.loader_offset + (float)i) % n) * 255 / n;
        c2d_set_fill_color(0, 0, 0, alfa);

        c2d_fill_circle(x1, y1, r2);
    }

    const float speed = 20;

    ctx.loader_offset += speed * delta_time;

    if (ctx.loader_offset >= (float)n) {
        ctx.loader_offset = 0.f;
    }
}

Points connect_points(Points points) {
    for (int k = 4; k < MAX_NEIGHBORS; ++k) {
        Points path = concave_hull(points, k);

        if (path.size > 0) {
            return path;
        }
    }

    printf("hull not found");

    int idx = 0; // points.size * Math.random();

    Vec2i p1 = points.data[idx];
    da_swap_remove(&points, idx);

    Points path = {};
    da_append(&path, p1);

    while (points.size > 0) {
        int min_dist = 2e9;
        int min_dist_idx = -1;

        for (int j = points.size - 1; j >= 0; j -= 1) {
            Vec2i p2 = points.data[j];

            if (min_dist > v2i_dist2(p1, p2)) {
                min_dist = v2i_dist2(p1, p2);
                min_dist_idx = j;
            }
        }

        p1 = points.data[min_dist_idx];
        da_swap_remove(&points, min_dist_idx);

        da_append(&path, p1);
    }

    return path;
}

