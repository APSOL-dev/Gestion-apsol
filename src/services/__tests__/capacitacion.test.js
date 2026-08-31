import { describe, test, expect, beforeEach } from 'vitest'

describe('extractYouTubeId', () => {
  let extractYouTubeId

  beforeEach(async () => {
    const mod = await import('../capacitacion.js')
    extractYouTubeId = mod.extractYouTubeId
  })

  test('extrae el id de una URL watch?v=', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=-T5i6wDOM2E&t=941s')).toBe('-T5i6wDOM2E')
  })

  test('extrae el id de una URL youtu.be corta', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  test('devuelve null si no es una URL de YouTube', () => {
    expect(extractYouTubeId('https://1drv.ms/v/c/abc123')).toBeNull()
  })

  test('devuelve null si no recibe nada', () => {
    expect(extractYouTubeId(null)).toBeNull()
    expect(extractYouTubeId(undefined)).toBeNull()
  })
})

describe('extractDriveFileIdFromLink', () => {
  let extractDriveFileIdFromLink

  beforeEach(async () => {
    const mod = await import('../capacitacion.js')
    extractDriveFileIdFromLink = mod.extractDriveFileIdFromLink
  })

  test('extrae el id de un link de compartir de Drive', () => {
    expect(extractDriveFileIdFromLink('https://drive.google.com/file/d/1Y_8XF7SWNgPP95MvXJWoAjOhP6q0gTmB/view?usp=sharing'))
      .toBe('1Y_8XF7SWNgPP95MvXJWoAjOhP6q0gTmB')
  })

  test('devuelve null para un link que no es de Drive', () => {
    expect(extractDriveFileIdFromLink('https://onedrive.live.com/?id=abc')).toBeNull()
  })
})

describe('getVideoPlaybackInfo', () => {
  let getVideoPlaybackInfo

  beforeEach(async () => {
    const mod = await import('../capacitacion.js')
    getVideoPlaybackInfo = mod.getVideoPlaybackInfo
  })

  test('clasifica un link de YouTube', () => {
    const video = { es_link_externo: true, link: 'https://www.youtube.com/watch?v=-T5i6wDOM2E' }
    expect(getVideoPlaybackInfo(video)).toEqual({
      kind: 'youtube',
      embedUrl: 'https://www.youtube.com/embed/-T5i6wDOM2E'
    })
  })

  test('clasifica un link de compartir de Drive como drive-embed', () => {
    const video = { es_link_externo: true, link: 'https://drive.google.com/file/d/ABC123/view?usp=sharing' }
    expect(getVideoPlaybackInfo(video)).toEqual({
      kind: 'drive-embed',
      embedUrl: 'https://drive.google.com/file/d/ABC123/preview'
    })
  })

  test('clasifica una URL directa a .mp4', () => {
    const video = { es_link_externo: true, link: 'https://cdn.example.com/video.mp4' }
    expect(getVideoPlaybackInfo(video)).toEqual({ kind: 'mp4', url: 'https://cdn.example.com/video.mp4' })
  })

  test('clasifica un link de OneDrive como external-link (no se puede embeber)', () => {
    const video = { es_link_externo: true, link: 'https://1drv.ms/v/c/abc123?e=xyz' }
    expect(getVideoPlaybackInfo(video)).toEqual({ kind: 'external-link', url: 'https://1drv.ms/v/c/abc123?e=xyz' })
  })

  test('clasifica un archivo subido a Drive por APSOL como drive-proxy', () => {
    const video = { es_link_externo: false, archivo_video: '1xA9poXDI9HUDdScNjWl7RPKvod8n8fzj' }
    expect(getVideoPlaybackInfo(video)).toEqual({ kind: 'drive-proxy', fileId: '1xA9poXDI9HUDdScNjWl7RPKvod8n8fzj' })
  })

  test('devuelve pending si no hay video cargado', () => {
    expect(getVideoPlaybackInfo({ es_link_externo: false, archivo_video: null })).toEqual({ kind: 'pending' })
    expect(getVideoPlaybackInfo({ es_link_externo: true, link: null })).toEqual({ kind: 'pending' })
    expect(getVideoPlaybackInfo(null)).toEqual({ kind: 'pending' })
  })
})

describe('buildDriveProxyUrl', () => {
  let buildDriveProxyUrl

  beforeEach(async () => {
    const mod = await import('../capacitacion.js')
    buildDriveProxyUrl = mod.buildDriveProxyUrl
  })

  test('arma la URL de la Edge Function con id y access_token', () => {
    const url = buildDriveProxyUrl('https://kursvmadozcqxoaeaccd.supabase.co', 'video-1', 'tok en/con+especiales')
    expect(url).toBe(
      'https://kursvmadozcqxoaeaccd.supabase.co/functions/v1/drive-video?id=video-1&access_token=tok%20en%2Fcon%2Bespeciales'
    )
  })

  test('funciona aunque la URL base tenga barra final', () => {
    const url = buildDriveProxyUrl('https://example.supabase.co/', 'abc', 'tok')
    expect(url).toBe('https://example.supabase.co/functions/v1/drive-video?id=abc&access_token=tok')
  })
})

describe('addVistoPor', () => {
  let addVistoPor

  beforeEach(async () => {
    const mod = await import('../capacitacion.js')
    addVistoPor = mod.addVistoPor
  })

  test('agrega el usuario si no estaba en la lista', () => {
    expect(addVistoPor(['u1'], 'u2')).toEqual(['u1', 'u2'])
  })

  test('no duplica si el usuario ya estaba', () => {
    const original = ['u1', 'u2']
    expect(addVistoPor(original, 'u2')).toBe(original)
  })

  test('funciona con lista vacía o nula', () => {
    expect(addVistoPor(null, 'u1')).toEqual(['u1'])
    expect(addVistoPor(undefined, 'u1')).toEqual(['u1'])
  })

  test('no agrega si no hay userId', () => {
    expect(addVistoPor(['u1'], null)).toEqual(['u1'])
  })
})

describe('nombreUsuario', () => {
  let nombreUsuario

  beforeEach(async () => {
    const mod = await import('../capacitacion.js')
    nombreUsuario = mod.nombreUsuario
  })

  const usuarios = [
    { id: 'u1', nombre: 'Adrian', apellido: 'Patriarca' },
    { id: 'u2', nombre: 'Renata', apellido: null }
  ]

  test('arma nombre y apellido', () => {
    expect(nombreUsuario(usuarios, 'u1')).toBe('Adrian Patriarca')
  })

  test('funciona si falta el apellido', () => {
    expect(nombreUsuario(usuarios, 'u2')).toBe('Renata')
  })

  test('devuelve "Usuario" si no lo encuentra', () => {
    expect(nombreUsuario(usuarios, 'inexistente')).toBe('Usuario')
    expect(nombreUsuario([], 'u1')).toBe('Usuario')
  })
})

describe('vistoPorDeTema', () => {
  let vistoPorDeTema

  beforeEach(async () => {
    const mod = await import('../capacitacion.js')
    vistoPorDeTema = mod.vistoPorDeTema
  })

  test('une el visto_por de todos los videos del tema sin duplicados', () => {
    const tema = {
      videos: [
        { visto_por: ['u1', 'u2'] },
        { visto_por: ['u2', 'u3'] }
      ]
    }
    expect(vistoPorDeTema(tema)).toEqual(['u1', 'u2', 'u3'])
  })

  test('devuelve lista vacía si no hay videos o nadie vio nada', () => {
    expect(vistoPorDeTema({ videos: [] })).toEqual([])
    expect(vistoPorDeTema({ videos: [{ visto_por: [] }] })).toEqual([])
    expect(vistoPorDeTema({})).toEqual([])
    expect(vistoPorDeTema(null)).toEqual([])
  })
})

describe('agruparPorClasificacion', () => {
  let agruparPorClasificacion

  beforeEach(async () => {
    const mod = await import('../capacitacion.js')
    agruparPorClasificacion = mod.agruparPorClasificacion
  })

  test('agrupa los temas por clasificación', () => {
    const temas = [
      { id: '1', clasificacion: 'N8N' },
      { id: '2', clasificacion: 'AppSheet' },
      { id: '3', clasificacion: 'N8N' }
    ]
    const grupos = agruparPorClasificacion(temas)
    expect(grupos).toEqual([
      ['AppSheet', [temas[1]]],
      ['N8N', [temas[0], temas[2]]]
    ])
  })

  test('agrupa sin clasificación bajo "Sin clasificar"', () => {
    const temas = [{ id: '1', clasificacion: null }]
    expect(agruparPorClasificacion(temas)).toEqual([['Sin clasificar', temas]])
  })

  test('devuelve lista vacía si no hay temas', () => {
    expect(agruparPorClasificacion([])).toEqual([])
    expect(agruparPorClasificacion(null)).toEqual([])
  })
})
