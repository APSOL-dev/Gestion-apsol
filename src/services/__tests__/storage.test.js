import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

const uploadMock = vi.fn()
const getPublicUrlMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock
      }))
    }
  }
}))

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(1787861918261)
    uploadMock.mockResolvedValue({ data: {}, error: null })
    getPublicUrlMock.mockImplementation(() => ({
      data: { publicUrl: `https://kursvmadozcqxoaeaccd.supabase.co/storage/v1/object/public/Bucket%20Publico/${uploadMock.mock.calls.at(-1)[0]}` }
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('sube el archivo con el timestamp como carpeta, no como prefijo del nombre', async () => {
    const { uploadFile } = await import('../storage')
    const archivo = { name: 'Pepito.pdf' }

    await uploadFile(archivo, 'facturacion/nueva')

    // El nombre real del archivo en el path subido debe quedar intacto
    // (con su extensión), sin timestamp pegado adelante.
    const pathSubido = uploadMock.mock.calls[0][0]
    expect(pathSubido).toBe('facturacion/nueva/1787861918261/Pepito.pdf')
  })

  test('la URL pública resultante termina exactamente en el nombre original del archivo', async () => {
    const { uploadFile } = await import('../storage')
    const archivo = { name: 'presentacion-whatsapp-verificacion.pdf' }

    const url = await uploadFile(archivo, 'facturacion/nueva')

    // Así, cuando n8n extrae el último segmento de la URL para nombrar el
    // adjunto que manda por WhatsApp, obtiene el nombre y la extensión
    // originales tal cual los subió el usuario - sin timestamp pegado.
    expect(url.endsWith('/presentacion-whatsapp-verificacion.pdf')).toBe(true)
    expect(decodeURIComponent(url).split('/').pop()).toBe('presentacion-whatsapp-verificacion.pdf')
  })
})
