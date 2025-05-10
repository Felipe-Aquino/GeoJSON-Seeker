all: hough main

STACK_SIZE=8388608
WASM_FLAGS=--target=wasm32 -flto -nostdlib -Wl,--no-entry -Wl,--allow-undefined -Wl,--export-all -Wl,--lto-O3
WASM_FLAGS2=--target=wasm32 -flto -nostdlib -Wl,--no-entry -Wl,--allow-undefined -Wl,--lto-O3

EXPORTED_NAMES=alloc init update set_process_result set_coord set_mouse_position set_mouse_pressed set_mouse_wheel
EXPORT_FLAG=$(foreach name,$(EXPORTED_NAMES),-Wl,--export=$(name))
PRINTF=-DDISABLE_PRINTF

hough:
	clang ${WASM_FLAGS} -Wl,-z,stack-size=${STACK_SIZE} -O3 -o hough.wasm hough.c

main: main.c
	clang ${WASM_FLAGS2} ${EXPORT_FLAG} ${PRINTF} -Wl,-z,stack-size=${STACK_SIZE} -O3 -o main.wasm main.c

assets.c: gen_assets.c
	clang -Wall -Wextra -Werror -o gen_assets gen_assets.c -lm
	./gen_assets > assets.c
	rm gen_assets
