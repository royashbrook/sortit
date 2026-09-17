// Tiny material cues, drawn once into stamps for a win. The animation only
// moves those stamps; no emoji fonts, image decoding or per-frame paths.
function polygon(g, points) {
  g.beginPath()
  points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y))
  g.closePath()
  g.fill()
  g.stroke()
}

export function drawConfettiPiece(g, skin, color, variant) {
  g.fillStyle = color
  g.strokeStyle = '#342E3CCC'
  g.lineWidth = 1
  g.lineJoin = 'round'

  switch (skin) {
    case 'bolts':
      if (variant === 1) {
        g.fillStyle = '#BCC8CF'
        g.fillRect(-2.5, -5, 5, 14)
        g.strokeRect(-2.5, -5, 5, 14)
        g.beginPath()
        for (let y = -2; y < 9; y += 3) { g.moveTo(-3, y); g.lineTo(3, y - 1) }
        g.stroke()
        g.fillStyle = color
        polygon(g, [[-6, -8], [6, -8], [6, -3], [-6, -3]])
      } else {
        g.beginPath()
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3
          const x = Math.cos(a) * 9, y = Math.sin(a) * 9
          if (i) g.lineTo(x, y); else g.moveTo(x, y)
        }
        g.closePath()
        g.moveTo(3.5, 0)
        g.arc(0, 0, 3.5, 0, Math.PI * 2)
        g.fill('evenodd')
        g.stroke()
        g.strokeStyle = '#FFFFFFAA'
        g.beginPath(); g.moveTo(-7, -3); g.lineTo(-3, -6); g.lineTo(3, -6); g.stroke()
      }
      break
    case 'mine':
      polygon(g, [[-8, -4], [0, -8], [8, -4], [8, 5], [0, 9], [-8, 5]])
      g.fillStyle = '#FFFFFF55'
      polygon(g, [[-8, -4], [0, -8], [8, -4], [0, 0]])
      g.fillStyle = '#00000033'
      polygon(g, [[0, 0], [8, -4], [8, 5], [0, 9]])
      g.fillStyle = '#FFFFFF66'
      g.fillRect(-6, -1, 2, 2)
      g.fillRect(-3, 3, 2, 2)
      break
    case 'dash':
      g.strokeStyle = '#FFFFFFDD'
      g.lineWidth = 1.2
      if (variant === 1) polygon(g, [[-1, -9], [-7, 1], [-1, 1], [-3, 9], [7, -2], [1, -2], [4, -9]])
      else polygon(g, [[0, -9], [3, -3], [9, 0], [3, 3], [0, 9], [-3, 3], [-9, 0], [-3, -3]])
      break
    case 'kawaii':
      g.strokeStyle = '#FFFFFFCC'
      if (variant === 1) {
        polygon(g, Array.from({ length: 10 }, (_, i) => {
          const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 4.5 : 9
          return [Math.cos(a) * r, Math.sin(a) * r]
        }))
      } else {
        g.beginPath()
        g.moveTo(0, 8)
        g.bezierCurveTo(-16, -2, -6, -13, 0, -5)
        g.bezierCurveTo(6, -13, 16, -2, 0, 8)
        g.fill(); g.stroke()
      }
      break
    case 'dice':
      g.beginPath(); g.roundRect(-8, -8, 16, 16, 4); g.fill(); g.stroke()
      g.fillStyle = '#FFFFFFEE'
      g.beginPath(); g.arc(0, 0, 1.7, 0, Math.PI * 2); g.fill(); g.stroke()
      if (variant > 0) {
        for (const [x, y] of [[-4, -4], [4, 4], ...(variant === 2 ? [[-4, 4], [4, -4]] : [])]) {
          g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI * 2); g.fill(); g.stroke()
        }
      }
      break
    default:
      if (variant === 1) {
        g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill()
        g.strokeStyle = '#FFFFFFBB'; g.stroke()
      } else g.fillRect(-4, -8, 8, 16)
  }
}
