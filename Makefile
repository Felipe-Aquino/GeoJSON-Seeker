all: wasm wasmtest native

STACK_SIZE=8388608 # 8MB
WASM_FLAGS=--target=wasm32 -flto -nostdlib -Wl,--no-entry -Wl,--allow-undefined -Wl,--export-all -Wl,-z,stack-size=${STACK_SIZE} -Wl,--lto-O3

wasm:
	clang ${WASM_FLAGS} -O3 -o hough.wasm hough.c

wasmtest:
	clang ${WASM_FLAGS} -O3 -DTEST -o hough-test.wasm hough.c

native:
	clang -g -Wall -Wextra -Werror -pedantic -DTEST test.c -o test -lm
