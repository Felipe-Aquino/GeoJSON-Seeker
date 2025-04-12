// #include <stdio.h>

typedef int (*cmp_t)(void *arr, int i, int j);

void swap(void *arr, int i, int j, int sz) {
    if (i != j) {
        char *a = (char *)arr + i * sz;
        char *b = (char *)arr + j * sz;

        for (int k = 0; k < sz; k += 1) {
            char aux = *a;
            *a = *b;
            *b = aux;

            a++;
            b++;
        }
    }
}

__attribute__((visibility("default")))
void qsort(void *arr, int n, int sz, cmp_t cmp) {
    if (n < 2) {
        return;
    }

    int p = n / 2;
    int i = 0;
    int j = n - 1;

    while (i < j) {
        if (cmp(arr, i, p) > 0) {
            swap(arr, i, p, sz);
            i += 1;
        } else if (cmp(arr, j, p) < 0) {
            swap(arr, j, p, sz);
            j -= 1;
        } else if (cmp(arr, i, j) > 0) {
            swap(arr, i, j, sz);

            if (i < p && cmp(arr, i, p) < 0) {
                i += 1;
            }

            if (j > p && cmp(arr, j, p) > 0) {
                j -= 1;
            }
        } else {
            i += 1;
            j -= 1;
        }
    }

    qsort(arr, n / 2, sz, cmp);

    char *arr2 = (char *)arr + sz * (n / 2);
    qsort(arr2, n - (n / 2), sz, cmp);
}

int int_cmp(void *arr, int i, int j) {
    int *arr2 = (int *)arr;

    return arr2[i] - arr2[j];
}

/*
int main() {
    int values[10] = { 30, 1, 15, 20, 10, 5, 0, 7, 40, 32 };

    for (int i = 0; i < 10; i += 1) {
        printf("%d ", values[i]);
    }
    printf("\n");

    qsort(values, sizeof(values) / sizeof(int), sizeof(int), int_cmp);

    for (int i = 0; i < 10; i += 1) {
        printf("%d ", values[i]);
    }
    printf("\n");
    printf("\n");

    int values2[11] = { 30, 1, 15, 20, 10, 5, 0, 7, 40, 32, 20 };

    for (int i = 0; i < 11; i += 1) {
        printf("%d ", values2[i]);
    }
    printf("\n");

    qsort(values2, sizeof(values2) / sizeof(int), sizeof(int), int_cmp);

    for (int i = 0; i < 11; i += 1) {
        printf("%d ", values2[i]);
    }
    printf("\n");

    return 0;
}
*/
