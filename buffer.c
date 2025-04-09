#include <stdarg.h>

struct Buffer {
  char data[256];
  int size;
};

static struct Buffer buffer = {0};

void buffer_write_char(char c) {
    buffer.data[buffer.size] = c;
    buffer.size += 1;
}

void buffer_write_str(char *data, int size) {
    for (int i = 0; i < size; ++i) {
        buffer.data[buffer.size + i] = data[i];
    }

    buffer.size += size;
}

void buffer_write_cstr(char *data) {
    while (*data) {
        buffer.data[buffer.size] = *data;
        data += 1;
        buffer.size += 1;
    }
}

void buffer_write_int(int n) {
  int negative = n < 0;
  
  if (negative) {
    buffer_write_char('-');
    n = -n;
  }

  int count = 0;

  do {
    char digit = '0' + (char)(n % 10);
    buffer_write_char(digit);
    n /= 10;
    count += 1;
  } while (n > 0);

  for (int i = 0; i < count / 2; ++i) {
    char aux = buffer.data[buffer.size - i - 1];
    buffer.data[buffer.size - i - 1] = buffer.data[buffer.size - count + i];
    buffer.data[buffer.size - count + i] = aux;
  }
}

void buffer_write_float(float n) {
  int negative = n < 0;
  
  if (negative) {
    buffer_write_char('-');
    n = -n;
  }

  int part1 = n;
  int part2 = 1000.f * (n - (float)part1);

  buffer_write_int(part1);
  buffer_write_char('.');
  buffer_write_int(part2);
}

void buffer_reset() {
  buffer.size = 0;
}

void buffer_format(const char *fmt, ...) {
  va_list args;
  va_start(args, fmt);

  char c = *fmt;
  char next_c = c == '\0' ? '\0' : *(fmt + 1);

  int n;
  float flt;
  char *str;

  while (c) {
    if (c == '%') {
      next_c = c == '\0' ? '\0' : *(fmt + 1);

      switch (next_c) {
        case 'd':
          n = va_arg(args, int);
          buffer_write_int(n);
          break;
        case 'f':
          flt = (float)va_arg(args, double);
          buffer_write_int(n);
          break;
        case 's':
          str = va_arg(args, char *);
          buffer_write_cstr(str);
          break;
        case 'S':
          n = va_arg(args, int);
          str = va_arg(args, char *);
          buffer_write_str(str, n);
          break;
        case '%':
          buffer_write_char('%');
          break;
        default:
          buffer_write_char(c);
          fmt -= 1;
          break;
      }

      fmt += 2;
    } else {
      buffer_write_char(c);
      fmt += 1;
    }

    c = *fmt;
  }

  va_end(args);
}
