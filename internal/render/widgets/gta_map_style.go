package widgets

import "image"

// GTA San Andreas radar palette, sampled from an in-game radar screenshot: black streets between
// light grey blocks, white buildings, dark green grass, blue-grey water.
var (
	gtaGround   = [3]float64{178, 178, 176}
	gtaBuilding = [3]float64{236, 235, 233}
	gtaPark     = [3]float64{57, 105, 41}
	gtaWater    = [3]float64{78, 110, 150}
	gtaRoad     = [3]float64{16, 16, 16}
)

// applyGTASAMapStyle turns an OpenStreetMap raster into the San Andreas radar look. Roads are
// extracted as masks so that label halos (white like roads) do not leave ghost letters: a halo
// always touches the map background, while a road is separated from it by its casing.
func applyGTASAMapStyle(img *image.RGBA) {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w == 0 || h == 0 {
		return
	}
	m := newMaskOps(w, h)
	n := w * h
	road, water, ground, bldg, park := make([]uint8, n), make([]uint8, n), make([]uint8, n), make([]uint8, n), make([]uint8, n)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			i := img.PixOffset(b.Min.X+x, b.Min.Y+y)
			p := y*w + x
			r, g, bl := int(img.Pix[i]), int(img.Pix[i+1]), int(img.Pix[i+2])
			chroma := max(r, g, bl) - min(r, g, bl)
			luma := (299*r + 587*g + 114*bl) / 1000
			switch {
			case bl > g+8 && g > r+14:
				water[p] = 1 // #aad3df
			case luma >= 244 && chroma < 12:
				road[p] = 1 // white streets (and label halos, removed below)
			case r >= 225 && g >= 140 && luma > 165 && r-bl >= 40 && g <= r+6:
				road[p] = 1 // primary, secondary, trunk; not #fa8072 footways or pale landuse fills
			case g > r+8 && g > bl+8:
				park[p], ground[p] = 1, 1 // parks, grass, forest
			case chroma >= 10 && luma >= 195 && luma < 226 && r >= g && g >= bl:
				bldg[p], ground[p] = 1, 1 // #d9d0c9 buildings
			case luma >= 226 && chroma < 40:
				ground[p] = 1 // background, parking, residential, school and commercial landuse
			}
		}
	}

	// Seed roads with pixels away from the background, regrow them through connected road pixels.
	// Radius 1: zoom-16 residential streets are only ~4px wide.
	near := m.morph(ground, 1, true)
	seeds := make([]uint8, n)
	for p := range seeds {
		if road[p] == 1 && near[p] == 0 {
			seeds[p] = 1
		}
	}
	m.reconstruct(seeds, road)
	road = seeds
	// Rails, names and arrows printed across a road: close small gaps over non-background pixels.
	closed := m.morph(m.morph(road, 3, true), 3, false)
	for p := range road {
		if closed[p] == 1 && ground[p] == 0 && water[p] == 0 {
			road[p] = 1
		}
	}
	m.fillHoles(road, 200)
	// Halo fragments that survived the seeding are small islands; streets form a network.
	m.dropSmall(road, 120)
	// The radar's streets are bold black bands.
	road = m.morph(road, 2, true)

	water = m.morph(m.morph(water, 3, true), 3, false)
	m.fillHoles(water, 500)
	m.dropSmall(water, 300)
	park = m.morph(m.morph(park, 1, false), 1, true)
	bldg = m.morph(m.morph(bldg, 1, false), 1, true)

	parkCov, bldgCov, waterCov, roadCov := m.soften(park), m.soften(bldg), m.soften(water), m.soften(road)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			p := y*w + x
			c := gtaGround
			layer := func(top [3]float64, k float32) {
				if k <= 0 {
					return
				}
				f := float64(k)
				for j := range c {
					c[j] = c[j]*(1-f) + top[j]*f
				}
			}
			layer(gtaPark, parkCov[p])
			layer(gtaBuilding, bldgCov[p])
			layer(gtaWater, waterCov[p])
			layer(gtaRoad, roadCov[p])
			i := img.PixOffset(b.Min.X+x, b.Min.Y+y)
			if img.Pix[i+3] == 0 {
				continue
			}
			img.Pix[i], img.Pix[i+1], img.Pix[i+2] = uint8(c[0]+0.5), uint8(c[1]+0.5), uint8(c[2]+0.5)
		}
	}
}

// maskOps is binary morphology on w*h 0/1 masks (square structuring element, separable).
type maskOps struct {
	w, h  int
	tmp   []uint8
	stack []int32
	seen  []uint8
}

func newMaskOps(w, h int) *maskOps {
	return &maskOps{w: w, h: h, tmp: make([]uint8, w*h), stack: make([]int32, 0, 1024), seen: make([]uint8, w*h)}
}

// morph returns a dilated (grow) or eroded copy of src with radius r.
func (m *maskOps) morph(src []uint8, r int, grow bool) []uint8 {
	w, h := m.w, m.h
	hit := uint8(0)
	if grow {
		hit = 1
	}
	for y := 0; y < h; y++ {
		row := y * w
		for x := 0; x < w; x++ {
			v := 1 - hit
			for k := max(0, x-r); k <= min(w-1, x+r); k++ {
				if src[row+k] == hit {
					v = hit
					break
				}
			}
			m.tmp[row+x] = v
		}
	}
	dst := make([]uint8, w*h)
	for x := 0; x < w; x++ {
		for y := 0; y < h; y++ {
			v := 1 - hit
			for k := max(0, y-r); k <= min(h-1, y+r); k++ {
				if m.tmp[k*w+x] == hit {
					v = hit
					break
				}
			}
			dst[y*w+x] = v
		}
	}
	return dst
}

func (m *maskOps) neighbours(p int, visit func(int)) {
	x := p % m.w
	if x > 0 {
		visit(p - 1)
	}
	if x < m.w-1 {
		visit(p + 1)
	}
	if p >= m.w {
		visit(p - m.w)
	}
	if p < m.w*(m.h-1) {
		visit(p + m.w)
	}
}

// reconstruct grows seeds (in place) through 4-connected pixels set in mask.
func (m *maskOps) reconstruct(seeds, mask []uint8) {
	stack := m.stack[:0]
	for p, v := range seeds {
		if v == 1 {
			stack = append(stack, int32(p))
		}
	}
	for len(stack) > 0 {
		p := int(stack[len(stack)-1])
		stack = stack[:len(stack)-1]
		m.neighbours(p, func(q int) {
			if mask[q] == 1 && seeds[q] == 0 {
				seeds[q] = 1
				stack = append(stack, int32(q))
			}
		})
	}
	m.stack = stack
}

// dropSmall clears 4-connected components with fewer than minArea pixels.
func (m *maskOps) dropSmall(mask []uint8, minArea int) {
	clear(m.seen)
	var comp []int32
	for i, v := range mask {
		if v == 0 || m.seen[i] == 1 {
			continue
		}
		comp = comp[:0]
		stack := append(m.stack[:0], int32(i))
		m.seen[i] = 1
		for len(stack) > 0 {
			p := int(stack[len(stack)-1])
			stack = stack[:len(stack)-1]
			comp = append(comp, int32(p))
			m.neighbours(p, func(q int) {
				if mask[q] == 1 && m.seen[q] == 0 {
					m.seen[q] = 1
					stack = append(stack, int32(q))
				}
			})
		}
		m.stack = stack
		if len(comp) < minArea {
			for _, p := range comp {
				mask[p] = 0
			}
		}
	}
}

// fillHoles sets enclosed background islands smaller than maxArea.
func (m *maskOps) fillHoles(mask []uint8, maxArea int) {
	inv := make([]uint8, len(mask))
	for p, v := range mask {
		inv[p] = 1 - v
	}
	m.dropSmall(inv, maxArea)
	for p, v := range inv {
		mask[p] = 1 - v
	}
}

// soften returns 3x3 box-blurred coverage (0..1) of a mask, for anti-aliased edges.
func (m *maskOps) soften(mask []uint8) []float32 {
	w, h := m.w, m.h
	out := make([]float32, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			s, c := 0, 0
			for yy := max(0, y-1); yy <= min(h-1, y+1); yy++ {
				for xx := max(0, x-1); xx <= min(w-1, x+1); xx++ {
					s += int(mask[yy*w+xx])
					c++
				}
			}
			out[y*w+x] = float32(s) / float32(c)
		}
	}
	return out
}
