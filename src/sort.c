typedef int (*sort_cmp_t)(void *arr, int i, int j, void *data);

void sort_swap(void *arr, int i, int j, int sz) {
    if (i != j) {
        if (sz % 4 != 0) {
            char *a = (char *)arr + i * sz;
            char *b = (char *)arr + j * sz;

            for (int k = 0; k < sz; k += 1) {
                char aux = *a;
                *a = *b;
                *b = aux;

                a++;
                b++;
            }
        } else {
            int n = sz / 4;

            int *a = (int *)arr + i * sz / 4;
            int *b = (int *)arr + j * sz / 4;

            for (int k = 0; k < n; k += 1) {
                int aux = *a;
                *a = *b;
                *b = aux;

                a++;
                b++;
            }
        }
    }
}

void bubble_sort(void *arr, int n, int sz, sort_cmp_t cmp, void *data) {
    bool done = true;
    for (int i = n - 1; i > 0; i -= 1) {
        done = true;

        for (int j = 0; j < i; j += 1) {
            if (cmp(arr, j, j + 1, data) > 0) {
                sort_swap(arr, j, j + 1, sz);
                done = false;
            }
        }

        if (done) {
            break;
        }
    }
}
