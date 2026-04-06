const net = require('net')
const { findFreePort } = require('./port')

describe('findFreePort', () => {
  test('resolves to a number', async () => {
    const port = await findFreePort()
    expect(typeof port).toBe('number')
    expect(port).toBeGreaterThan(1024)
  })

  test('resolved port is not in use', async () => {
    const port = await findFreePort()
    // Try to bind to it — should succeed
    await expect(
      new Promise((resolve, reject) => {
        const s = net.createServer()
        s.listen(port, '127.0.0.1', () => { s.close(); resolve() })
        s.on('error', reject)
      })
    ).resolves.toBeUndefined()
  })

  test('skips occupied ports', async () => {
    // Occupy a port, then ask findFreePort starting from that port
    const occupied = await new Promise((resolve) => {
      const s = net.createServer()
      s.listen(0, '127.0.0.1', () => resolve({ server: s, port: s.address().port }))
    })

    const found = await findFreePort(occupied.port)
    occupied.server.close()

    expect(found).not.toBe(occupied.port)
  })
})
