// Context 2D auxiliary functions

void c2d_set_fill_color(int r, int g, int b, int a);
void c2d_set_stroke_color(int r, int g, int b, int a);
void c2d_line(float x1, float y1, float x2, float y2, float width);
void c2d_quad(float x1, float y1, float x2, float y2, float width);
void c2d_fill_quad(float x1, float y1, float x2, float y2);
void c2d_circle(float x, float y, float r, float width);
void c2d_fill_circle(float x, float y, float r);
void c2d_image(unsigned char *ptr, int x, int y, int w, int h);
void c2d_image_a(unsigned char *ptr, int xs, int ys, int xd, int yd, int w, int h);
void c2d_image_s(unsigned char *ptr, int x, int y, int w, int h, int dw, int dh);
void c2d_fill_text(const char *ptr, int len, float x, float y, float size);
float c2d_text_width(const char *ptr, int len, float size);

void c2d_fill_text2(const char *ptr, float x, float y, float size) {
    buffer_write_cstr((char *)ptr);
    c2d_fill_text(buffer.data, buffer.size, x, y, size);
    buffer.size = 0;
}

float c2d_text_width2(const char *ptr, float size) {
    buffer_write_cstr((char *)ptr);
    float width = c2d_text_width(buffer.data, buffer.size, size);
    buffer.size = 0;

    return width;
}
