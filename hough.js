// https://en.wikipedia.org/wiki/Line_detection
// https://en.wikipedia.org/wiki/Hough_transform

function line_from_points(p1, p2) {
    if (p1.x === p2.x) {
        const a = 1;
        const b = 0;
        const c = -p1.y;
        const step = {
            x: 0,
            y: p1.y > p2.y ? -1 : 1,
        };
        return { a, b, c, step };
    }
    if (p1.y === p2.y) {
        const a = 0;
        const b = 1;
        const c = -p1.x;
        const step = {
            x: p1.x > p2.x ? -1 : 1,
            y: 0,
        };
        return { a, b, c, step };
    }
    const a = 1;
    const b = -(p2.y - p1.y) / (p2.x - p1.x);
    const c = -(a * p1.y + b * p1.x);
    const step = {
        x: p1.x > p2.x ? -1 : 1,
        y: 0,
    };
    return { a, b, c, step };
}

function line_get_y(l, x) {
    return -l.c - l.b * x;
}

function line_contains(l, p, error = 0) {
    return Math.abs(l.a * p.y + l.b * p.x + l.c) <= error;
}

function hough_create(pixels, width, height) {
    const diagonal_length = Math.sqrt(width * width + height * height);
    const radius_step = 4;
    const angles_division_count = 50;
    const radius_division_count = 1 + Math.floor(diagonal_length / radius_step);
    const angles_step = Math.PI / angles_division_count;
    const buckets = new Array(angles_division_count * radius_division_count);

    buckets.fill(null);

    return {
        angles_division_count,
        radius_division_count,
        angles_step,
        radius_step,
        buckets,
        width,
        height,
        img_pixels: pixels,
    };
}

function hough_proccess(hough) {
    const angles = [];
    for (let theta = 0; theta < Math.PI; theta += hough.angles_step) {
        angles.push([Math.cos(theta), Math.sin(theta)]);
    }
    const numPixels = 4 * hough.width * hough.height;
    let pixel_idx = 0;
    for (let i = 0; i < numPixels; i += 4) {
        if (hough.img_pixels[i] === 0) {
            let theta = 0;
            const row = (pixel_idx / hough.width) >> 0; // Hack: faster than Math.floor
            const col = pixel_idx % hough.width;
            for (let ang_idx = 0; ang_idx < hough.angles_division_count; ang_idx += 1) {
                const r = col * angles[ang_idx][0] + row * angles[ang_idx][1];
                const rad_idx = (r / hough.radius_step) >> 0;
                const pos = ang_idx + rad_idx * hough.radius_division_count;
                if (hough.buckets[pos]) {
                    hough.buckets[pos].push([row, col]);
                }
                else {
                    hough.buckets[pos] = [[row, col]];
                }
            }
        }
        pixel_idx += 1;
    }
}

function percetile(p, values) {
    if (p > 1 || p < 0 || values.length === 0) {
        return 0;
    }
    if (p === 1) {
        return values[values.length - 1];
    }
    if (values.length === 1) {
        return values[0];
    }
    const pos = (values.length - 1) * p;
    const idx = Math.floor(pos);
    const t = pos - idx;
    return values[idx] + (values[idx + 1] - values[idx]) * t;
}

function dist2(p1, p2) {
    const dx = p2[1] - p1[1];
    const dy = p2[0] - p1[0];
    return dx * dx + dy * dy;
}

function hough_lines_of_interest(hough) {
    const lines = [];
    const buckets = [];
    const countings = [];

    for (let i = 0; i < hough.buckets.length; i += 1) {
        const bucket = hough.buckets[i];
        if (bucket) {
            buckets.push(bucket);
            countings.push(bucket.length);
        }
    }
    countings.sort((a, b) => a - b);
    const threshold = percetile(0.90, countings);
    for (let i = 0; i < buckets.length; i += 1) {
        const bucket = buckets[i];
        if (bucket && bucket.length > threshold) {
            bucket.sort((p1, p2) => {
                const dx = p1[1] - p2[1];
                if (dx === 0) {
                    const dy = p1[0] - p2[0];
                    return dy;
                }
                return dx;
            });
            let min_dist = 1000000;
            // Eliminating points too distant on the line
            for (let i = 0; i < bucket.length - 1; i += 1) {
                const d = dist2(bucket[i], bucket[i + 1]);
                if (min_dist > d) {
                    min_dist = d;
                }
            }
            // if (lines.length === 5) {
            //   console.log('before', min_dx, bucket.slice());
            // }
            const split_points = [0];
            for (let i = 0; i < bucket.length - 1; i += 1) {
                const d = dist2(bucket[i], bucket[i + 1]);
                if (d > min_dist) {
                    split_points.push(i + 1);
                }
            }
            split_points.push(bucket.length);
            const sz = lines.length;
            if (split_points.length > 2) {
                for (let j = 0; j < split_points.length - 1; j += 1) {
                    const start = split_points[j];
                    const end = split_points[j + 1];
                    if (end - start > 3) {
                        const min_pt = bucket[start];
                        const max_pt = bucket[end - 1];
                        if (dist2(min_pt, max_pt) > 9) {
                            lines.push([
                                { x: min_pt[1], y: min_pt[0] },
                                { x: max_pt[1], y: max_pt[0] },
                            ]);
                        }
                    }
                }
            }
            else {
                const min_pt = bucket[0];
                const max_pt = bucket[bucket.length - 1];
                if (dist2(min_pt, max_pt) > 9) {
                    lines.push([
                        { x: min_pt[1], y: min_pt[0] },
                        { x: max_pt[1], y: max_pt[0] },
                    ]);
                }
            }
        }
        // if (bucket && bucket.length > threshold) {
        //   let min_pt = bucket[0];
        //   let max_pt = bucket[0];
        //   for (const pt of bucket) {
        //     if (min_pt[0] > pt[0] || (min_pt[0] === pt[0] && pt[1] < min_pt[1])) {
        //       min_pt = pt;
        //     }
        //     if (max_pt[0] < pt[0] || (max_pt[0] === pt[0] && pt[1] > max_pt[1])) {
        //       max_pt = pt;
        //     }
        //   }
        //   lines.push([
        //     { x: min_pt[1], y: min_pt[0] },
        //     { x: max_pt[1], y: max_pt[0] },
        //   ]);
        // }
    }
    return lines;
}
