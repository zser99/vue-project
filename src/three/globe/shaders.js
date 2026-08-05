// 지구본용 GLSL 셰이더 모음.
// 별도 로더 플러그인 없이 템플릿 리터럴로 보관한다.

export const earthVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vPosW = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// 낮/밤 텍스처 블렌딩 + 야간 도시 불빛 + 바다 스페큘러 + 림 산란.
// uSunDir 는 실제 UTC 시각의 태양 직하점 방향 (geoMath.getSunDirection).
export const earthFragmentShader = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uWaterMask; // 흰색 = 바다
  uniform vec3 uSunDir;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);

    vec3 dayColor = texture2D(uDayMap, vUv).rgb;
    vec3 nightColor = texture2D(uNightMap, vUv).rgb;

    // 터미네이터(낮/밤 경계)를 부드럽게
    float cosSun = dot(N, normalize(uSunDir));
    float dayFactor = smoothstep(-0.12, 0.25, cosSun);

    // 밤 면은 도시 불빛을 살짝 증폭해서 감성 포인트로
    vec3 color = mix(nightColor * 1.7, dayColor, dayFactor);

    // 바다 위 태양 반사 (낮 면에서만) — 지수를 높여 글린트를 좁고 또렷하게
    float water = texture2D(uWaterMask, vUv).r;
    vec3 R = reflect(-normalize(uSunDir), N);
    float spec = pow(max(dot(R, V), 0.0), 48.0) * water * dayFactor;
    color += vec3(0.9, 0.95, 1.0) * spec * 0.35;

    // 가장자리 대기 산란 느낌의 림 라이트
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    color += vec3(0.25, 0.45, 0.85) * rim * (0.2 + 0.4 * dayFactor);

    gl_FragColor = vec4(color, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormalV;

  void main() {
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// BackSide + AdditiveBlending 으로 지구 바깥에 푸른 글로우를 두른다
export const atmosphereFragmentShader = /* glsl */ `
  varying vec3 vNormalV;

  void main() {
    float intensity = pow(0.7 - dot(vNormalV, vec3(0.0, 0.0, 1.0)), 4.0);
    gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
  }
`
