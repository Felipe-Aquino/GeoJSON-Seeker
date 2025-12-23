all: content.wasm popup.wasm

STACK_SIZE=8388608
WASM_FLAGS=--target=wasm32 -flto -nostdlib -Wl,--no-entry -Wl,--allow-undefined -Wl,--lto-O3

POPUP_EXPORTED_NAMES=alloc init update set_is_website_supported set_process_result set_is_loading set_mouse_position set_mouse_pressed set_mouse_wheel
POPUP_EXPORT_FLAGS=$(foreach name,$(POPUP_EXPORTED_NAMES),-Wl,--export=$(name))

CONTENT_EXPORTED_NAMES=alloc free_all points_of_interest
CONTENT_EXPORT_FLAGS=$(foreach name,$(CONTENT_EXPORTED_NAMES),-Wl,--export=$(name))

#PRINTF=-DDISABLE_PRINTF
PRINTF=

content.wasm: src/content.c src/buffer.c src/hough.c src/core.c
	clang ${WASM_FLAGS} ${CONTENT_EXPORT_FLAGS} ${PRINTF} -Wl,-z,stack-size=${STACK_SIZE} -O3 -o content.wasm src/content.c

popup.wasm: src/context.c src/assets.c src/popup.c src/buffer.c src/core.c src/concave_hull.c src/sort.c src/ui.c src/c2d.h
	clang ${WASM_FLAGS} ${POPUP_EXPORT_FLAGS} ${PRINTF} -Wl,-z,stack-size=${STACK_SIZE} -O3 -o popup.wasm src/popup.c

