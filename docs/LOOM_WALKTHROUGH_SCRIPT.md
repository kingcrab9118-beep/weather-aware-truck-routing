# Loom Walkthrough — Full Scripts (KO / EN)

**Length:** 약 7–9분 (5–10분 요구사항)  
**Pick one language** for the recording; both scripts follow the same beats.  
**Prep:** Backend `http://127.0.0.1:8001`, Frontend `http://127.0.0.1:5173`. Optionally run analyze once before recording.

---

## Before you hit Record

1. Font size in IDE: 14–16  
2. Browser map tiles OK (no Carto “API KEY REQUIRED”)  
3. Demo inputs: Origin `Chicago, IL` · Destination `Denver, CO` · Load `35000` · Sample `25 miles`  
4. Layout: browser left / code right, or switch windows in Loom  

### Timeline

| Time | Screen | Topic |
|------|--------|--------|
| 0:00–0:50 | Browser | Intro |
| 0:50–2:40 | Browser | Live demo |
| 2:40–3:20 | `services.py` | Pipeline |
| 3:20–4:20 | `providers.py`, `geo.py` | Routes + sampling |
| 4:20–5:30 | `weather.py`, `risk.py` | ETA weather + risk rules |
| 5:30–6:20 | `risk.py` | Recommendation |
| 6:20–7:40 | `RouteMap.jsx`, `HeatmapLayer.jsx` | Map + heatmap |
| 7:40–8:20 | Browser | Close |

---

# 한국어 완전 대본

아래를 **그대로 읽어도** 되고, 자연스럽게 조금 줄여도 됩니다.  
`【…】` 는 말로 하지 않는 **화면 지시**입니다.

---

## 1. 인트로 (0:00–0:50)

【화면: 브라우저 앱 전체. 왼쪽 사이드바 → 오른쪽 맵을 마우스로 가리킴】

안녕하세요. 이 프로젝트는 **Weather-Aware Truck Routing**, 날씨를 고려한 트럭 경로 추천 웹앱입니다.

사용자는 **출발지, 도착지, 출발 일시, 적재 중량**을 입력합니다.  
그러면 앱이 라우팅 API로 **경로 후보를 최대 세 개** 만들고, 경로를 따라 **10마일, 25마일, 또는 50마일마다** 체크포인트를 찍습니다.  
각 체크포인트에서는 **그 지점에 도착할 예상 시각의 날씨**를 가져와, 과제에 주어진 **위험도 임계값과 적재 규칙**으로 risk를 계산합니다.  
마지막으로 **Severe 구간 마일 → High 구간 마일 → 평균 risk → 이동 시간** 순서로 가장 안전한 경로를 추천하고, 지도와 **0시간부터 48시간 예보 히트맵**으로 보여 줍니다.

기술 스택은 **React와 Vite 프론트엔드**, **Django REST 백엔드**입니다.  
경로 탐색 엔진은 직접 만들지 않았고, **OpenRouteService 또는 OSRM**, 지오코딩은 **Nominatim**, 날씨는 **Open-Meteo**를 사용합니다.

---

## 2. 라이브 데모 (0:50–2:40)

### 2-1. 입력

【사이드바 Trip inputs를 가리키며 필드를 하나씩 보여 줌】

왼쪽이 입력 폼입니다.  
출발지는 Chicago, Illinois, 도착지는 Denver, Colorado로 두겠습니다.  
출발 시각은 앞으로 몇 시간 뒤를 선택하고, 적재 중량은 **삼만 오천 파운드**, 샘플링 간격은 **이십오 마일**입니다.  
이 값들은 과제 요구사항의 origin, destination, departure, load weight, 그리고 10·25·50마일 샘플링에 해당합니다.

【**Find safest routes** 클릭. 로딩 중이면 아래 문장】

지금 **Find safest routes**를 누르면, 프론트가 Django의 **`POST /api/analyze/`** 한 번을 호출합니다.  
그 안에서 지오코딩, 경로 생성, 날씨 샘플링, risk 계산, 추천, 히트맵까지 한 번에 처리됩니다.  
장거리라서 이십 초에서 사십 초 정도 걸릴 수 있습니다.

【이미 결과가 있으면】  
여기에는 미리 돌려 둔 Chicago–Denver 분석 결과가 있습니다.

### 2-2. 추천

【Recommendation 카드】

결과가 나오면 먼저 **Recommendation** 카드가 보입니다.  
이 경로가 스펙의 우선순위에 따라 고른 **추천 경로**입니다.  
거리, 예상 소요 시간, 평균 risk 점수가 함께 표시됩니다.

### 2-3. 경로 옵션과 지도

【Route options에서 A/B/C를 번갈아 클릭. 맵 폴리라인 두께 변화 보여 줌】

아래에 **Route options**가 있습니다. 최대 세 개 경로가 순위와 함께 나열되고, Severe·High 같은 risk 마일리지 요약이 칩으로 보입니다.  
카드를 클릭하면 오른쪽 지도에서 **선택된 경로가 더 굵게** 강조됩니다.

【체크포인트 초록/노란 점을 클릭해 팝업】

경로 위의 점들이 **체크포인트**입니다.  
클릭하면 **마일 지점, ETA, 풍속·강수·강설, 최종 risk 등급**이 나옵니다.  
중요한 점은, 날씨가 “지금 현재 날씨”가 아니라 **트럭이 그 지점에 도착할 시각의 예보**라는 것입니다.

### 2-4. 히트맵 슬라이더

【하단 Weather heatmap 슬라이더를 천천히 좌우로 움직임. Show heatmap 토글】

왼쪽 아래는 **경로 복도 corridor의 0–48시간 날씨 히트맵**입니다.  
슬라이더를 움직이면 예보 시각이 바뀌고, 맵 위 히트 강도가 같이 바뀝니다.  
체크박스로 히트맵을 끌 수도 있어서, 경로와 체크포인트만 보고 싶을 때 유용합니다.

이상으로 UI 데모였습니다. 이제 이 동작이 코드에서 어떻게 이어지는지 보겠습니다.

---

## 3. 파이프라인 — `services.py` (2:40–3:20)

【파일 열기: `backend/routing/services.py` · 글자 크게】

백엔드의 중심은 **`analyze_trip` 함수**입니다. 십칠 행부터 시작합니다.

【17–23행 하이라이트】  
함수 인자가 곧 요구사항 입력입니다. origin, destination, departure, load weight, 그리고 sample interval입니다.  
이십사 행에서 interval이 10, 25, 50만 허용되는지 검증합니다.

【33–35행】  
Nominatim으로 지오코딩한 뒤, **`fetch_routes`**로 경로 후보를 가져옵니다.

【40–50행】  
각 경로마다 polyline을 따라 **`sample_along_route`**로 체크포인트를 만들고, **`fetch_weather_at_points`**로 ETA 기준 날씨를 붙입니다.

【55–60행】  
그 날씨에 **`classify_checkpoint_weather`**를 적용해 risk와 load 규칙을 계산합니다.

【79행, 84행】  
경로 단위로 **`summarize_route_risk`**, 그리고 **`recommend_routes`**로 순위를 매깁니다.

【95행】  
마지막으로 **`fetch_heatmap_forecast`**로 48시간 히트맵 데이터를 만듭니다.

【잠깐 `views.py` 80–112행】  
프론트는 **`POST /api/analyze/`**만 호출하고, view가 이 `analyze_trip`을 실행합니다.

---

## 4. 경로 3개 + 샘플링 (3:20–4:20)

### 4-1. `providers.py`

【`backend/routing/providers.py` · 61–65행, 202–217행】

**`providers.py`**는 외부 라우팅 API를 담당합니다.  
OpenRouteService 키가 있으면 우선 사용하고, 특히 트럭용 **driving-hgv** 프로필을 시도합니다.  
무료 플랜에서는 장거리에 alternative routes 제한이 있어서, 그 경우 **경유점 via-point로 다른 경로를 만들어** 최대 세 개를 채웁니다.

이백이 행의 **`fetch_routes`**를 보면, ORS로 충분히 못 채우면 **OSRM으로 fallback**합니다.  
즉, 라우팅 엔진을 직접 구현하지 않고도 과제 요구의 **세 개 route options**를 만족합니다.

### 4-2. `geo.py`

【`backend/routing/geo.py` · 32–75행, 79–96행】

**`sample_along_route`**는 경로 좌표를 따라 누적 거리를 계산하면서, 사용자가 고른 **10, 25, 또는 50마일마다** 점을 삽입합니다.  
출발점과 도착점은 항상 포함됩니다.  
UI의 Sample every 값이 바로 이 `interval_mi`로 들어갑니다.

---

## 5. ETA 날씨 + Risk 규칙 (4:20–5:30)

### 5-1. `weather.py`

【`backend/routing/weather.py` · 45–49행, 76–81행】

**`fetch_weather_at_points`**가 핵심입니다.  
칠십육–팔십일 행을 보시면, 체크포인트까지 거리 비율 `frac`을 구하고,  
`eta = 출발시각 + 전체소요시간 × frac`으로 **도착 예정 시각**을 만듭니다.  
그다음 Open-Meteo hourly 시계열에서 **그 ETA에 가장 가까운 시간 슬롯**을 고릅니다.  
풍속은 mph, 비와 눈은 inch per hour로 바꿔 risk 모듈에 넘깁니다.

### 5-2. `risk.py` — 임계값과 적재

【`backend/routing/risk.py` · 17–27, 29–39, 41–50, 57–75, 78–92행】

**`risk.py`**는 과제 스펙의 Risk Rules를 그대로 코드로 옮긴 파일입니다.

- **`classify_wind`**: 25 미만 Low, 25–34 Moderate, 35–44 High, 45–54 Severe, 55 이상 No Travel.  
- **`classify_rain`**, **`classify_snow`**도 표의 inch per hour 구간과 동일합니다.

**`apply_load_rules`**, 오십칠 행부터입니다.  
풍속 55 이상이면 적재와 무관하게 No Travel.  
45–54에 적재가 삼만 파운드를 넘으면 No Travel.  
35–44에 사만 파운드를 넘으면 Severe로 올립니다.

**`classify_checkpoint_weather`**는 wind, rain, snow 중 **가장 나쁜 등급**을 고른 뒤, load 규칙을 한 번 더 적용합니다.

---

## 6. 추천 로직 (5:30–6:20)

【같은 `risk.py` · 123–174, 177–197, 199–214행】

**`summarize_route_risk`**는 체크포인트 risk를 **마일 가중**으로 모아 Severe miles, High miles, 평균 risk를 만듭니다.

**`recommend_routes`** docstring과 `sort_key`를 보시면, 정렬 키가 스펙 Prefer 순서와 같습니다.  
일번 Severe miles가 적은 쪽, 이번 High miles, 삼번 평균 risk, 사번 이동 시간.  
No Travel 구간이 있는 경로는 뒤로 밀립니다.  
일등에게 `recommended = True`를 붙입니다.

【선택: `tests.py` 16–44, 51–79행 잠깐】  
임계값과 “Severe miles가 더 적은 경로를 고른다”는 단위 테스트도 있습니다.

---

## 7. UI · 맵 · 히트맵 (6:20–7:40)

### 7-1. `RouteMap.jsx`

【`frontend/src/components/RouteMap.jsx` · 15–22행, 폴리라인·CircleMarker 구간】

프론트 지도는 Leaflet입니다.  
베이스맵은 API 키가 필요 없는 **Esri Dark Gray** 타일입니다.  
세 경로를 Polyline으로 그리고, 선택 여부에 따라 두께와 투명도를 바꿉니다.  
체크포인트는 CircleMarker로 risk 색을 칠하고, 팝업에 ETA와 기상값을 넣습니다.

### 7-2. `HeatmapLayer.jsx`

【`frontend/src/components/HeatmapLayer.jsx` · 10–43행】

**`HeatmapLayer`**는 `hourIndex`에 해당하는 intensity만 골라 **leaflet.heat** 레이어를 그립니다.  
슬라이더가 바뀌면 이전 레이어를 제거하고 새로 올려, 0–48시간 예보를 부드럽게 보여 줍니다.

### 7-3. 브라우저로 복귀

【슬라이더를 다시 한 번 움직임】

UI의 추천 카드, 경로 목록, 체크포인트 리스트, 맵, 히트맵은 **같은 analyze 응답 JSON**을 공유합니다.  
그래서 화면이 항상 한 번의 분석 결과와 일치합니다.

---

## 8. 마무리 (7:40–8:20)

【브라우저 전체 또는 README】

정리하겠습니다.  
이 앱은 과제 요구사항대로 **입력 네 가지**, **경로 세 개**, **마일 간격 날씨 샘플링**, **ETA 기준 예보**, **risk와 load 규칙**, **지정된 추천 우선순위**, **지도와 체크포인트**, **0–48시간 히트맵**을 구현했습니다.  
핵심 비즈니스 로직은 **`risk.py`와 `services.py`**에 모아 두었고, 라우팅·지오코딩·날씨는 외부 API를 사용했습니다.  
시청해 주셔서 감사합니다.

【호스팅 URL이 있으면 화면에 띄우고 한 줄】  
배포된 앱 주소는 여기입니다.

---

# Full English Script

Read aloud as written, or shorten slightly.  
`【…】` = **stage direction** (do not speak).

---

## 1. Intro (0:00–0:50)

【Screen: full app. Point at sidebar, then map】

Hi — this is **Weather-Aware Truck Routing**, a web app that helps a truck driver choose the safest route using weather, load weight, and travel time.

The user enters an **origin, destination, departure date and time, and load weight**.  
The app then generates **up to three route options** from a routing API, samples weather along each route every **ten, twenty-five, or fifty miles**, and at each checkpoint it uses the weather for the truck’s **estimated arrival time** at that point.  
It classifies risk with the project’s **wind, rain, and snow thresholds** plus the **load rules**, then recommends a route by preferring **fewest Severe miles, then fewest High miles, then lowest average risk, then shortest travel time**.  
Everything is shown on a map, with a **zero-to-forty-eight-hour weather heatmap** along the trip corridor.

The stack is **React with Vite** on the frontend and **Django REST** on the backend.  
I did **not** build a routing engine — I use **OpenRouteService or OSRM** for routes, **Nominatim** for geocoding, and **Open-Meteo** for weather.

---

## 2. Live demo (0:50–2:40)

### 2-1. Inputs

【Point at Trip inputs; show each field】

Here is the input form.  
I’ll use **Chicago, Illinois** as the origin and **Denver, Colorado** as the destination, pick a departure a few hours from now, set the load to **thirty-five thousand pounds**, and sample every **twenty-five miles**.  
Those map directly to the required inputs and the ten / twenty-five / fifty mile sampling options.

【Click **Find safest routes**. While loading:】

When I click **Find safest routes**, the frontend calls Django **`POST /api/analyze/` once**.  
That single request runs geocoding, routing, weather sampling, risk scoring, recommendation, and the heatmap.  
A long haul like Chicago to Denver can take about twenty to forty seconds.

【If results are already loaded:】  
I’m showing a Chicago–Denver analysis I ran just before recording.

### 2-2. Recommendation

【Recommendation card】

At the top of the results you’ll see the **Recommendation** card — the route chosen by the project’s ranking rules — with distance, travel time, and average risk.

### 2-3. Route options and map

【Click Route A / B / C; show polyline emphasis】

Under **Route options** you get up to three ranked corridors, with pills for Severe and High miles.  
Clicking a card **thickens that polyline** on the map.

【Click a checkpoint marker → popup】

The dots are **checkpoints**.  
The popup shows **mile marker, ETA, wind, rain, snow, and final risk**.  
Weather here is **not “current conditions everywhere”** — it’s the forecast for when the truck is expected to **arrive at that checkpoint**.

### 2-4. Heatmap slider

【Drag 0–48h slider; toggle Show heatmap】

Bottom-left is the **corridor weather heatmap for hours zero through forty-eight**.  
Moving the slider changes forecast time and heatmap intensity.  
You can also hide the heatmap to focus on routes and checkpoints.

That’s the UI. Next I’ll walk through the code that powers it.

---

## 3. Pipeline — `services.py` (2:40–3:20)

【Open `backend/routing/services.py`】

The backend spine is **`analyze_trip`**, starting around **line 17**.

【Highlight 17–23】  
The parameters are exactly the required inputs: origin, destination, departure, load weight, and sample interval.  
**Line 24** validates that the interval is only ten, twenty-five, or fifty.

【33–35】  
We geocode with Nominatim, then call **`fetch_routes`** for up to three alternatives.

【40–50】  
For each route we **`sample_along_route`**, then **`fetch_weather_at_points`** at each ETA.

【55–60】  
**`classify_checkpoint_weather`** applies the risk and load rules.

【79, 84】  
**`summarize_route_risk`** aggregates miles; **`recommend_routes`** ranks them.

【95】  
**`fetch_heatmap_forecast`** builds the forty-eight-hour corridor grid.

【Briefly `views.py` 80–112】  
The frontend only hits **`POST /api/analyze/`**, which calls this function.

---

## 4. Three routes + sampling (3:20–4:20)

### 4-1. `providers.py`

【Open `backend/routing/providers.py` — lines 61–65, 202–217】

**`providers.py`** wraps external routing APIs.  
If an OpenRouteService key is present, we prefer it — including the **driving-hgv** profile when possible.  
On the free tier, alternative routes are limited for long distances, so we also build variants with **via-points** to reach up to three options.

**`fetch_routes` around line 202** falls back to **OSRM** if ORS doesn’t give enough alternatives.  
So we meet the “three route options” requirement **without writing a routing engine**.

### 4-2. `geo.py`

【Open `backend/routing/geo.py` — 32–75, 79–96】

**`sample_along_route`** walks the polyline by cumulative miles and inserts checkpoints every **ten, twenty-five, or fifty miles**, always including start and end.  
The UI “Sample every” control becomes this `interval_mi`.

---

## 5. ETA weather + risk rules (4:20–5:30)

### 5-1. `weather.py`

【Open `backend/routing/weather.py` — 45–49, 76–81】

**`fetch_weather_at_points`** is the ETA logic.  
Around **lines 76–81**, we compute `frac = distance / total miles`, then  
`eta = departure + total duration × frac`.  
We pick the Open-Meteo hourly slot closest to that ETA, convert wind to mph and precip to inches per hour, and pass them to risk.

### 5-2. `risk.py` — thresholds and load

【Open `backend/routing/risk.py` — 17–27, 29–39, 41–50, 57–75, 78–92】

**`risk.py`** implements the assignment tables literally.

- **`classify_wind`**: under 25 Low, 25–34 Moderate, 35–44 High, 45–54 Severe, 55 and above No Travel.  
- Rain and snow use the same inch-per-hour bands from the spec.

**`apply_load_rules` from line 57:**  
55 mph or more → No Travel for any load;  
45–54 with load over 30,000 lb → No Travel;  
35–44 with load over 40,000 lb → bump to Severe.

**`classify_checkpoint_weather`** takes the **worst of wind, rain, and snow**, then applies load rules.

---

## 6. Recommendation (5:30–6:20)

【Same file — 123–174, 177–197, 199–214】

**`summarize_route_risk`** turns checkpoint scores into **mile-weighted** Severe miles, High miles, and average risk.

**`recommend_routes`** sorts with a key that matches the spec:  
first fewest Severe miles, then High, then average risk, then duration.  
Routes with No Travel miles rank last.  
Rank one gets `recommended = True`.

【Optional: `tests.py` 16–44, 51–79】  
Unit tests cover the thresholds and that we prefer fewer Severe miles.

---

## 7. UI · map · heatmap (6:20–7:40)

### 7-1. `RouteMap.jsx`

【Open `frontend/src/components/RouteMap.jsx` — BaseTiles, polylines, markers】

The map is **Leaflet**.  
Basemap tiles are **Esri Dark Gray** — no API key required.  
We draw up to three **Polylines**, emphasize the selected route, and show **CircleMarkers** colored by risk with ETA and weather in the popup.

### 7-2. `HeatmapLayer.jsx`

【Open `frontend/src/components/HeatmapLayer.jsx` — 10–43】

**`HeatmapLayer`** reads intensity for the current **`hourIndex`** and builds a **leaflet.heat** layer.  
When the slider moves, we remove and recreate the layer so the zero-to-forty-eight-hour forecast updates smoothly.

### 7-3. Back to the browser

【Nudge the slider once more】

The recommendation, route list, checkpoints, map, and heatmap all share **one analyze JSON response**, so the UI stays consistent.

---

## 8. Close (7:40–8:20)

【Full app or README】

To wrap up: this app implements the brief — **four inputs**, **three routes**, **mile-interval weather sampling**, **ETA-based forecasts**, **risk and load rules**, **the required recommendation order**, **map with checkpoints**, and a **zero-to-forty-eight-hour heatmap**.  
Business logic lives mainly in **`risk.py` and `services.py`**; routing, geocoding, and weather come from third-party APIs.  
Thanks for watching.

【If hosted, show URL】  
Here’s the deployed app.

---

## Quick cue card (both languages)

```
Browser demo
→ services.py 17–95
→ providers.py 202 · geo.py 32
→ weather.py 76–81
→ risk.py 17–75 + 177–197
→ RouteMap.jsx · HeatmapLayer.jsx
→ Close
```

**Tip:** Spend ≥2 minutes on risk / ETA / recommendation, ≥1.5 minutes on map / heatmap — those are 80% of the grade.
