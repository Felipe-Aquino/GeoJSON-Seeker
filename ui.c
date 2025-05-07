#include <stdbool.h>
#include "common.h"
#include "c2d.h"

typedef struct UI {
    int hot_id;
    int last_hot_id;
    int pressed_id;
    int last_pressed_id;

    // pin_icon: null,
    // path_icon: null,
    // broom_icon: null,
    // clipboard_icon: null,

    bool show_buttons;

    int mouse_x;
    int mouse_y;
    bool mouse_is_pressed;
    int mouse_wheel_dx;
    int mouse_wheel_dy;

    int scroll_offset_x;
    int scroll_offset_y;
} UI;

UI ui = {
    .hot_id = -1,
    .last_hot_id = -1,
    .pressed_id = -1,
    .last_pressed_id = -1,

    .show_buttons = true,

    .mouse_x = 0,
    .mouse_y = 0,
    .mouse_is_pressed = false,
    .mouse_wheel_dx = 0,
    .mouse_wheel_dy = 0,

    .scroll_offset_x = 0,
    .scroll_offset_y = 0,
};


void ui_reset() {
    ui.last_hot_id = ui.hot_id;
    ui.hot_id = -1;

    ui.last_pressed_id = ui.pressed_id;
    ui.pressed_id = -1;

    ui.mouse_wheel_dx = 0;
    ui.mouse_wheel_dy = 0;
}

int ui_cyrb53(const char *str, int seed) {
    unsigned h1 = 0xdeadbeef ^ seed;
    unsigned h2 = 0x41c6ce57 ^ seed;

    unsigned ch = *str;

    while (ch) {
        h1 = (h1 ^ ch) * 2654435761;
        h2 = (h2 ^ ch) * 1597334677;
        
        str += 1;
        ch = (unsigned)*str;
    }

    h1 = ((h1 ^ (h1 >> 16)) * 2246822507);
    h1 = ((h2 ^ (h2 >> 13)) * 3266489909) ^ h1;
    h2 = ((h2 ^ (h2 >> 16)) * 2246822507);
    h2 = ((h1 ^ (h1 >> 13)) * 3266489909) ^ h2;

    return 4294967296 * (2097151 & h2) + (h1 >> 0);
}

void ui_set_mouse_position(float x, float y) {
    ui.mouse_x = (int) x;
    ui.mouse_y = (int) y;
}

void ui_set_mouse_pressed(bool p) {
    ui.mouse_is_pressed = p;
}

void ui_set_mouse_wheel(float dx, float dy) {
    ui.mouse_wheel_dx = (int) dx;
    ui.mouse_wheel_dy = (int) dy;

    ui.scroll_offset_x += (int) dx;
    ui.scroll_offset_y += (int) dy;
}

bool button(const char *name, int x, int y) {
    const int id = ui_cyrb53(name, x * y);

    const int w = c2d_text_width2(name, 16) + 16;
    const int h = 40;

    bool clicked = false;

    if (ui.mouse_x >= x && ui.mouse_x <= x + w && ui.mouse_y >= y && ui.mouse_y <= y + h) {
        ui.hot_id = id;

        if (ui.mouse_is_pressed) {
            ui.pressed_id = id;
            if (id != ui.last_pressed_id) {
                clicked = true;
            }

            c2d_set_fill_color(0x33, 0x33, 0x33, 0xff);
        } else {
            c2d_set_fill_color(21, 188, 163, 0xff);
        }
    } else {
        c2d_set_fill_color(0, 0xd1, 0xb2, 0xff);
    }

    c2d_set_stroke_color(0x27, 0x74, 0x2e, 0xff);

    c2d_fill_quad(x, y, w, h);
    c2d_quad(x, y, w, h, 0.5);

    c2d_set_fill_color(0xff, 0xff, 0xff, 0xff);

    c2d_fill_text2(name, x + 8, y + h / 2 - 7, 16);

    return clicked;
}

bool icon_button(Image icon, const char *name, int x, int y, bool toggle) {
    const int id = ui_cyrb53(name, x * y);

    const int icon_w = 20;
    const int icon_h = 20;
    const int w = icon_w + 16;
    const int h = 40;

    bool clicked = false;

    if (ui.mouse_x >= x && ui.mouse_x <= x + w && ui.mouse_y >= y && ui.mouse_y <= y + h) {
        ui.hot_id = id;

        if (ui.mouse_is_pressed) {
            ui.pressed_id  = id;

            if (id != ui.last_pressed_id) {
                clicked = true;
            }

            c2d_set_fill_color(0x33, 0x33, 0x33, 0xff);
        } else {
            c2d_set_fill_color(21, 188, 163, 0xff);
        }
    } else {
        c2d_set_fill_color(0, 0xd1, 0xb2, 0xff);
    }

    if (toggle) {
        c2d_set_fill_color(0x33, 0x33, 0x33, 0xff);
    }

    c2d_set_stroke_color(0x27, 0x74, 0x2e, 0xff);

    const int w2 = (ui.hot_id == id || toggle)
        ? w + c2d_text_width2(name, 16) + 6
        : w;

    c2d_fill_quad(x, y, w2, h);
    c2d_quad(x, y, w2, h, 0.5);

    c2d_image_s(
        (void *) icon.pixels,
        x + (w - icon_w) / 2,
        y + (h - icon_h) / 2,
        icon.width,
        icon.height,
        icon_w,
        icon_h
    );

    if (ui.hot_id == id || toggle) {
        c2d_set_fill_color(0xff, 0xff, 0xff, 0xff);

        c2d_fill_text2(
            name,
            x + icon_w + 8 + 6,
            y + h / 2 - 7,
            16
        );
    }

    return clicked;
}

bool show_hide_button(int x, int y, bool is_hidden) {
    const int id = ui_cyrb53("<>", x * y);

    char name[3] = {
        194,
        is_hidden ? 187 : 171,
        '\0',
    };

    const int w = c2d_text_width2(name, 16) + 8;
    const int h = 40;

    int a = 0xa0;

    bool clicked = false;

    if (ui.mouse_x >= x && ui.mouse_x <= x + w && ui.mouse_y >= y && ui.mouse_y <= y + h) {
        ui.hot_id = id;

        a = 0xff;

        if (ui.mouse_is_pressed) {
            ui.pressed_id  = id;
            if (id != ui.last_pressed_id) {
                clicked = true;
            }

            c2d_set_fill_color(0x33, 0x33, 0x33, a);
        } else {
            c2d_set_fill_color(21, 188, 163, a);
        }

    } else {
        c2d_set_fill_color(0, 0xd1, 0xb2, a);
    }

    c2d_set_stroke_color(0x27, 0x74, 0x2e, a);

    c2d_fill_quad(x, y, w, h);
    c2d_quad(x, y, w, h, 0.5);

    c2d_set_fill_color(0xff, 0xff, 0xff, a);

    c2d_fill_text2(name, x + 4, y + h / 2 - 7, 16);

    return clicked;
}

#define THICKNESS 8.f

int vscrolbar(float width, float min_height, float max_height) {
    if (min_height < max_height) {
        const float bar_h = MAX(min_height * min_height / max_height, THICKNESS);

        if (ui.scroll_offset_y < 0) {
            ui.scroll_offset_y = 0;
        }
        if (ui.scroll_offset_y + bar_h > min_height) {
            ui.scroll_offset_y = min_height - bar_h;
        }

        c2d_set_fill_color(0, 0, 0, 0x7f);
        c2d_fill_quad(width - THICKNESS - 1.f, ui.scroll_offset_y, THICKNESS, bar_h);

        return (max_height - min_height) * ui.scroll_offset_y / (min_height - bar_h);
    }

    return 0;
}

int hscrolbar(float height, float min_width, float max_width) {
    if (min_width < max_width) {
        const float bar_w = MAX(min_width * min_width / max_width, THICKNESS);

        if (ui.scroll_offset_x < 0) {
            ui.scroll_offset_x = 0;
        }
        if (ui.scroll_offset_x + bar_w > min_width) {
            ui.scroll_offset_x = min_width - bar_w;
        }

        c2d_set_fill_color(0, 0, 0, 0x7f);
        c2d_fill_quad(ui.scroll_offset_x, height - THICKNESS - 1.f, bar_w, THICKNESS);

        return (max_width - min_width) * ui.scroll_offset_x / (min_width - bar_w);
    }

    return 0;
}
