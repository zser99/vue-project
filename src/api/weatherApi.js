import axios from 'axios'
import { worldCities, countryToCityId } from '@/data/worldCities'

const API_KEY = import.meta.env.VITE_OWM_API_KEY

// OpenWeather 공통 클라이언트 — 날씨(data/2.5)와 지오코딩(geo/1.0)이 같은 호스트를 쓴다
const owm = axios.create({
  baseURL: 'https://api.openweathermap.org',
  params: { appid: API_KEY },
})

// OpenWeather 응답 데이터를 화면에서 쓰기 편한 형태로 정리
const normalizeWeather = (data, nameOverride) => {
  // 구조분해 + 옵셔널 체이닝으로 필요한 값만 추출
  const { main = {}, wind = {}, weather = [], sys = {}, coord = {}, name } = data ?? {}
  const [{ description, icon } = {}] = weather

  return {
    name: nameOverride || name,
    tempC: main.temp,
    feelsLikeC: main.feels_like,
    tempMinC: main.temp_min,
    tempMaxC: main.temp_max,
    humidity: main.humidity,
    pressure: main.pressure,
    windSpeed: wind.speed,
    description,
    icon,
    sunrise: sys.sunrise,
    sunset: sys.sunset,
    lat: coord.lat,
    lon: coord.lon,
  }
}

// data/2.5/weather 는 lat/lon 기반 조회 시 격자점 하나의 순간값만 돌려주는 경우가 많아
// temp_min === temp_max === temp 로 나올 때가 있다 (한국 도시들에서 특히 자주 발생).
// 그럴 땐 5일/3시간 예보에서 "오늘" 구간의 기온 분포로 진짜 최저/최고를 다시 계산한다.
const fetchTodayMinMax = async (lat, lon, timezoneOffsetSec) => {
  const { data } = await owm.get('/data/2.5/forecast', {
    params: { lat, lon, units: 'metric', lang: 'kr' },
  })
  const list = data?.list ?? []
  if (!list.length) return null

  const offset = timezoneOffsetSec ?? data?.city?.timezone ?? 0
  const localDay = (dt) => Math.floor((dt + offset) / 86400)
  const today = localDay(list[0].dt)
  const todaysEntries = list.filter((entry) => localDay(entry.dt) === today)
  // 자정 근처라 "오늘" 구간이 거의 없으면 앞으로의 8구간(24시간)으로 대체
  const entries = todaysEntries.length >= 2 ? todaysEntries : list.slice(0, 8)

  const temps = entries.flatMap(({ main }) => [main?.temp_min, main?.temp_max, main?.temp])
    .filter((v) => typeof v === 'number')
  if (!temps.length) return null

  return { min: Math.min(...temps), max: Math.max(...temps) }
}

// 위도/경도로 날씨 가져오기
export const fetchWeatherByCoords = async (lat, lon, name) => {
  const { data } = await owm.get('/data/2.5/weather', {
    params: { lat, lon, units: 'metric', lang: 'kr' },
  })
  const weather = normalizeWeather(data, name)

  if (weather.tempMinC === weather.tempMaxC) {
    const range = await fetchTodayMinMax(lat, lon, data?.timezone).catch(() => null)
    if (range) {
      weather.tempMinC = Math.min(range.min, weather.tempMinC)
      weather.tempMaxC = Math.max(range.max, weather.tempMaxC)
    }
  }

  return weather
}

// 검색어 → 좌표. 단계별 폴백:
//   1) 내장 worldCities 한글 도시명 매칭 (즉시, 네트워크 불필요)
//   2) 나라 이름 → 그 나라 수도/대표 도시 (예: 프랑스 → 파리)
//   3) 한글 검색어는 Nominatim 우선 (OWM 은 한글 음차 매칭이 부정확해
//      '몽골'→인도네시아 Monggol 마을 같은 오답을 내놓는다), 영문은 OWM 우선
const searchViaOwm = async (keyword) => {
  const { data } = await owm.get('/geo/1.0/direct', { params: { q: keyword, limit: 1 } })
  const [hit] = data ?? []
  if (!hit) return null
  return { name: hit.local_names?.ko ?? hit.name, lat: hit.lat, lon: hit.lon }
}

const searchViaNominatim = async (keyword) => {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: { q: keyword, format: 'json', limit: 1, 'accept-language': 'ko' },
  })
  const [place] = data ?? []
  if (!place) return null
  return {
    name: place.display_name?.split(',')[0]?.trim() || keyword,
    lat: Number(place.lat),
    lon: Number(place.lon),
  }
}

const searchCityCoords = async (keyword) => {
  const local =
    worldCities.find(({ nameKo }) => nameKo === keyword) ??
    worldCities.find(({ id }) => id === countryToCityId[keyword])
  if (local) return { name: local.nameKo, lat: local.lat, lon: local.lon }

  const isHangul = /[가-힣]/.test(keyword)
  const [primary, secondary] = isHangul
    ? [searchViaNominatim, searchViaOwm]
    : [searchViaOwm, searchViaNominatim]

  return (await primary(keyword).catch(() => null)) ?? (await secondary(keyword).catch(() => null))
}

// 도시 이름(한글/영문)으로 날씨 가져오기
export const fetchWeatherByCityName = async (cityName) => {
  const found = await searchCityCoords(cityName)
  if (!found) {
    throw new Error('해당 도시를 찾을 수 없어요. 도시 이름을 다시 확인해주세요.')
  }
  return fetchWeatherByCoords(found.lat, found.lon, found.name)
}

// 좌표 → 가장 가까운 지명 (바다 등 지명이 없으면 null)
export const fetchReverseGeocode = async (lat, lon) => {
  const { data } = await owm.get('/geo/1.0/reverse', { params: { lat, lon, limit: 1 } })
  const [place] = data ?? []
  if (!place) return null
  // local_names.ko 가 있으면 한글 지명 우선
  return { name: place.local_names?.ko ?? place.name, country: place.country }
}

// 날씨 아이콘 이미지 주소 만들기
export const getIconUrl = (iconCode) => `https://openweathermap.org/img/wn/${iconCode}@2x.png`
