import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Volume2, VolumeX } from 'lucide-react';

const BIRTHDAY_MESSAGE =
  "Happy Birthday! On your special day, I hope the sky above you shines a little brighter and every moment brings a smile you didn't even see coming. May this new chapter of your life be filled with good health, steady peace of mind, and the kind of quiet happiness that stays long after the celebration ends. Chase the dreams that make your heart feel alive, let go of whatever weighs you down, and surround yourself with people who genuinely value your kindness and spirit. Whenever things feel busy or uncertain, remember how far you have already come and how much good is still waiting ahead of you. Here is to new adventures, warm memories, small daily wins, and big milestones that make you proud. May the year ahead reward your efforts, surprise you with blessings, and bring you closer to everything you truly wish for. Have a wonderful birthday today and an unforgettable year ahead!";

const MUSIC_DURATION_SEC = 15.0; // Step 2: Music plays for 15s, then gift box flies away
const MUSIC_FADE_DURATION_SEC = 2.0; // Smooth volume fade-out from 13s -> 15s
const MUSIC_BASE_VOLUME = 0.85;
const PICTURE_HOLD_SEC = 10.0; // Step 3: Hold pickture.jpg + fireworks for exactly 10s
const WIND_DURATION_SEC = 1.35; // Step 4: Wind-blown dissolve duration before final message

function easeOutBounce(x) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    const t = x - 1.5 / d1;
    return n1 * t * t + 0.75;
  } else if (x < 2.5 / d1) {
    const t = x - 2.25 / d1;
    return n1 * t * t + 0.9375;
  } else {
    const t = x - 2.625 / d1;
    return n1 * t * t + 0.984375;
  }
}

function createCircleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export default function App() {
  const mountRef = useRef(null);
  const audioRef = useRef(null);
  const musicFinishedRef = useRef(false);
  const startDropRef = useRef(null);

  // 'intro' | 'introLoading' | 'introExit' | 'dropping' | 'idle' | 'opened' | 'picture' | 'wind' | 'message'
  const [phase, setPhase] = useState('intro');
  const [isMuted, setIsMuted] = useState(false);
  const [hasAudioStarted, setHasAudioStarted] = useState(false);
  const [imgError, setImgError] = useState(false);

  const pictureUrl = `${import.meta.env.BASE_URL}pickture.jpg`;

  const handleGetStarted = () => {
    if (phase !== 'intro') return;
    setPhase('introLoading');

    setTimeout(() => {
      setPhase('introExit');
      if (startDropRef.current) {
        startDropRef.current();
      }
      setTimeout(() => {
        setPhase((prev) => (prev === 'introExit' ? 'dropping' : prev));
      }, 450);
    }, 5000);
  };

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.muted) {
      audio.muted = false;
      setIsMuted(false);
      if (audio.paused && hasAudioStarted && !musicFinishedRef.current) {
        audio.play().catch(() => {});
      }
    } else {
      audio.muted = true;
      setIsMuted(true);
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Pre-initialize Audio with Vite BASE_URL (GitHub Pages safe)
    const audioUrl = `${import.meta.env.BASE_URL}happy-bithday.mp3`;
    const audio = new Audio(audioUrl);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = MUSIC_BASE_VOLUME;
    audioRef.current = audio;
    musicFinishedRef.current = false;

    // 2. Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      120
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const updateCameraLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspect = width / height;
      camera.aspect = aspect;

      if (aspect < 1) {
        camera.position.z = Math.min(Math.max(7.2 / aspect, 9.5), 17.5);
        camera.position.y = 1.5;
      } else {
        camera.position.z = 8.4;
        camera.position.y = 1.4;
      }
      camera.lookAt(0, -0.35, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    updateCameraLayout();

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xb8c4ff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.0);
    keyLight.position.set(5, 9, 7);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 1.3);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xff7eb3, 1.2, 18);
    fillLight.position.set(-4, -1, 5);
    scene.add(fillLight);

    // 4. Twinkling 3D Starfield
    const circleTexture = createCircleTexture();
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xffe6a3),
      new THREE.Color(0xc4b5fd),
      new THREE.Color(0xfbcfe8),
    ];

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 46;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 32;
      starPositions[i * 3 + 2] = -6 - Math.random() * 26;
      const c = starPalette[i % starPalette.length];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.22,
      map: circleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 5. Build Detailed 3D Gift Box (hidden above screen until "Getting Started" is clicked)
    const giftRoot = new THREE.Group();
    const restY = -1.25;
    giftRoot.position.set(0, 9.5, 0);
    giftRoot.visible = false;
    scene.add(giftRoot);

    const boxBodyMat = new THREE.MeshStandardMaterial({
      color: 0xb91c3c,
      roughness: 0.28,
      metalness: 0.18,
    });

    const boxInnerMat = new THREE.MeshStandardMaterial({
      color: 0x2b0714,
      roughness: 0.85,
      metalness: 0.05,
    });

    const goldRibbonMat = new THREE.MeshStandardMaterial({
      color: 0xffd15c,
      roughness: 0.2,
      metalness: 0.88,
      emissive: 0x3b2400,
      emissiveIntensity: 0.25,
    });

    const bodyGroup = new THREE.Group();
    giftRoot.add(bodyGroup);

    bodyGroup.add(
      new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.4), boxBodyMat)
    );

    const innerRimMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.18, 0.08, 2.18),
      boxInnerMat
    );
    innerRimMesh.position.y = 0.98;
    bodyGroup.add(innerRimMesh);

    bodyGroup.add(
      new THREE.Mesh(new THREE.BoxGeometry(2.46, 2.02, 0.38), goldRibbonMat),
      new THREE.Mesh(new THREE.BoxGeometry(0.38, 2.02, 2.46), goldRibbonMat)
    );

    const innerLight = new THREE.PointLight(0xffcf54, 0, 16, 1.4);
    innerLight.position.set(0, 0.8, 0);
    bodyGroup.add(innerLight);

    const glowBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffd86b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowBeam = new THREE.Mesh(
      new THREE.ConeGeometry(2.3, 4.8, 32, 1, true),
      glowBeamMat
    );
    glowBeam.position.set(0, 3.1, 0);
    glowBeam.rotation.x = Math.PI;
    bodyGroup.add(glowBeam);

    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 1.15, 0);
    giftRoot.add(lidGroup);

    lidGroup.add(
      new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.46, 2.62), boxBodyMat),
      new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.49, 0.4), goldRibbonMat),
      new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.49, 2.68), goldRibbonMat)
    );

    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, 0.34, 0);
    lidGroup.add(bowGroup);

    const bowLoopGeo = new THREE.TorusGeometry(0.42, 0.11, 14, 32);
    for (let i = 0; i < 4; i++) {
      const loop = new THREE.Mesh(bowLoopGeo, goldRibbonMat);
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      loop.rotation.y = angle;
      loop.rotation.x = Math.PI / 3.4;
      loop.position.set(Math.sin(angle) * 0.34, 0.14, Math.cos(angle) * 0.34);
      loop.scale.set(1.05, 0.72, 1);
      bowGroup.add(loop);
    }

    const bowKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 20, 20),
      goldRibbonMat
    );
    bowKnot.position.y = 0.08;
    bowGroup.add(bowKnot);

    // 6. 3D Particle System (Box Sparkles, Festive Sky Fireworks, Wind Gust)
    const fireworksGroup = new THREE.Group();
    scene.add(fireworksGroup);

    const fireworkColors = [
      0xffd700, 0xff4d94, 0x38bdf8, 0xa855f7, 0x34d399, 0xff7849, 0xfef08a,
    ];

    const bursts = [];

    const spawnBoxSparkles = () => {
      const particleCount = 90;
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 1.1;
        positions[i * 3 + 1] = restY + 0.9;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 1.1;

        velocities[i * 3] = (Math.random() - 0.5) * 3.8;
        velocities[i * 3 + 1] = 2.8 + Math.random() * 4.5;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 3.8;

        const c = new THREE.Color(
          fireworkColors[Math.floor(Math.random() * fireworkColors.length)]
        );
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.25,
        map: circleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geometry, material);
      fireworksGroup.add(points);

      bursts.push({
        points,
        velocities,
        gravity: 2.2,
        drag: 0.98,
        life: 0,
        maxLife: 1.8,
      });
    };

    const spawnSkyBurst = () => {
      const spreadX = camera.aspect < 1 ? 5.6 : 11.5;
      const origin = new THREE.Vector3(
        (Math.random() - 0.5) * spreadX,
        2.5 + Math.random() * 2.5,
        -1.5 - Math.random() * 4.5
      );

      const primaryColor = new THREE.Color(
        fireworkColors[Math.floor(Math.random() * fireworkColors.length)]
      );
      const secondaryColor = new THREE.Color(
        fireworkColors[Math.floor(Math.random() * fireworkColors.length)]
      );

      const particleCount = 125;
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = origin.x;
        positions[i * 3 + 1] = origin.y;
        positions[i * 3 + 2] = origin.z;

        const theta = Math.random() * Math.PI * 2;
        const speed = 1.6 + Math.random() * 3.8;
        const upwardBias = (Math.random() - 0.62) * 2.4;

        velocities[i * 3] = Math.cos(theta) * speed;
        velocities[i * 3 + 1] = upwardBias;
        velocities[i * 3 + 2] = Math.sin(theta) * speed * 0.7;

        const c = i % 3 === 0 ? secondaryColor : primaryColor;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.3,
        map: circleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geometry, material);
      fireworksGroup.add(points);

      bursts.push({
        points,
        velocities,
        gravity: 2.85,
        drag: 0.982,
        life: 0,
        maxLife: 2.3 + Math.random() * 0.8,
      });
    };

    const spawnSkyShower = () => {
      const spreadX = camera.aspect < 1 ? 7.0 : 14.0;
      const particleCount = 45;
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spreadX;
        positions[i * 3 + 1] = 4.5 + Math.random() * 2.2;
        positions[i * 3 + 2] = -1.0 - Math.random() * 5.0;

        velocities[i * 3] = (Math.random() - 0.5) * 0.85;
        velocities[i * 3 + 1] = -(1.4 + Math.random() * 2.1);
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

        const c = new THREE.Color(
          fireworkColors[Math.floor(Math.random() * fireworkColors.length)]
        );
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.24,
        map: circleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geometry, material);
      fireworksGroup.add(points);

      bursts.push({
        points,
        velocities,
        gravity: 1.25,
        drag: 0.992,
        life: 0,
        maxLife: 2.8 + Math.random() * 0.7,
      });
    };

    const spawnWindGust = () => {
      const particleCount = 160;
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const windPalette = [
        new THREE.Color(0xffe699),
        new THREE.Color(0xffd700),
        new THREE.Color(0xfbcfe8),
        new THREE.Color(0xffffff),
      ];

      const spanX = camera.aspect < 1 ? 5.5 : 10.5;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spanX;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 4.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 2.0;

        velocities[i * 3] = 6.5 + Math.random() * 8.0;
        velocities[i * 3 + 1] = 0.8 + Math.random() * 2.2;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.4;

        const c = windPalette[i % windPalette.length];
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.24,
        map: circleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geometry, material);
      fireworksGroup.add(points);

      bursts.push({
        points,
        velocities,
        gravity: -0.3,
        drag: 0.985,
        life: 0,
        maxLife: 1.5,
      });
    };

    // 7. Interaction via Raycaster (Desktop + Mobile Touch)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // 'intro' | 'dropping' | 'idle' | 'shaking' | 'openedWait' | 'flyingAway' | 'pictureHold' | 'windBlow' | 'message'
    let animPhase = 'intro';
    let dropElapsed = 0;

    startDropRef.current = () => {
      if (animPhase !== 'intro') return;
      giftRoot.visible = true;
      dropElapsed = 0;
      animPhase = 'dropping';
    };
    const dropDuration = 1.45;
    let shakeElapsed = 0;
    const shakeDuration = 0.18;
    let openElapsed = 0;
    let flyElapsed = 0;
    const flyDuration = 0.9;
    let pictureElapsed = 0;
    let windElapsed = 0;
    let burstTimer = 0;
    let showerTimer = 0;

    let musicStarted = false;
    let musicElapsed = 0;

    const triggerOpenBox = () => {
      if (animPhase !== 'idle') return;
      animPhase = 'shaking';
      shakeElapsed = 0;
      musicStarted = true;
      musicElapsed = 0;
      musicFinishedRef.current = false;

      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.volume = MUSIC_BASE_VOLUME;
        audioRef.current
          .play()
          .then(() => {
            setHasAudioStarted(true);
          })
          .catch(() => {});
      }
    };

    const handlePointerDown = (event) => {
      if (animPhase !== 'idle') return;

      const rect = renderer.domElement.getBoundingClientRect();
      const clientX =
        event.touches && event.touches.length > 0
          ? event.touches[0].clientX
          : event.clientX;
      const clientY =
        event.touches && event.touches.length > 0
          ? event.touches[0].clientY
          : event.clientY;

      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(giftRoot.children, true);

      if (intersects.length > 0) {
        triggerOpenBox();
      }
    };

    const handlePointerMove = (event) => {
      if (animPhase !== 'idle') {
        renderer.domElement.style.cursor = 'default';
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(giftRoot.children, true);
      renderer.domElement.style.cursor =
        intersects.length > 0 ? 'pointer' : 'default';
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('resize', updateCameraLayout);

    // 8. Main Animation Loop
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      stars.rotation.y = elapsed * 0.02;
      starMaterial.opacity = 0.7 + Math.sin(elapsed * 2.2) * 0.2;

      // Music 15s timer with smooth 2s fade-out (13s -> 15s)
      if (musicStarted && !musicFinishedRef.current && audioRef.current) {
        musicElapsed += delta;
        const fadeStart = MUSIC_DURATION_SEC - MUSIC_FADE_DURATION_SEC;
        if (musicElapsed >= MUSIC_DURATION_SEC) {
          audioRef.current.volume = 0;
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          musicFinishedRef.current = true;
        } else if (musicElapsed >= fadeStart) {
          const fadeRatio =
            (musicElapsed - fadeStart) / MUSIC_FADE_DURATION_SEC;
          audioRef.current.volume = Math.max(
            MUSIC_BASE_VOLUME * (1 - fadeRatio),
            0
          );
        }
      }

      // Step 1: Gift Box Drops
      if (animPhase === 'dropping') {
        dropElapsed += delta;
        const t = Math.min(dropElapsed / dropDuration, 1);
        const eased = easeOutBounce(t);
        giftRoot.position.y = 9.5 + (restY - 9.5) * eased;
        giftRoot.rotation.y = (1 - t) * Math.PI * 1.2 + 0.45;

        if (t >= 1) {
          animPhase = 'idle';
          setPhase('idle');
        }
      } else if (animPhase === 'idle') {
        giftRoot.position.y = restY + Math.sin(elapsed * 2.1) * 0.14;
        giftRoot.rotation.y += delta * 0.55;
      } else if (animPhase === 'shaking') {
        shakeElapsed += delta;
        giftRoot.position.x = (Math.random() - 0.5) * 0.11;
        giftRoot.rotation.z = (Math.random() - 0.5) * 0.12;

        if (shakeElapsed >= shakeDuration) {
          giftRoot.position.x = 0;
          giftRoot.rotation.z = 0;
          animPhase = 'openedWait';
          openElapsed = 0;
          setPhase('opened');
          spawnBoxSparkles();
          spawnBoxSparkles();
        }
      } else if (animPhase === 'openedWait') {
        // Step 2: Lid pops open & flies completely off-screen within ~0.8s; box stays in place for 15s
        openElapsed += delta;

        const lidFlyDuration = 0.8;
        if (lidGroup.visible) {
          const lt = Math.min(openElapsed / lidFlyDuration, 1);
          const easeIn = lt * lt;
          lidGroup.position.y += delta * (7.5 + easeIn * 14.0);
          lidGroup.position.x += delta * (3.8 + easeIn * 6.5);
          lidGroup.position.z -= delta * (2.5 + easeIn * 5.0);
          lidGroup.rotation.z -= delta * 6.0;
          lidGroup.rotation.x += delta * 3.8;
          lidGroup.scale.setScalar(Math.max(1 - easeIn, 0));

          if (lt >= 1) {
            lidGroup.visible = false;
          }
        }

        const lightProgress = Math.min(openElapsed / 0.55, 1);
        innerLight.intensity =
          lightProgress * (5.2 + Math.sin(elapsed * 6) * 0.7);
        glowBeamMat.opacity =
          lightProgress * (0.3 + Math.sin(elapsed * 4.5) * 0.06);

        giftRoot.position.y = restY + Math.sin(elapsed * 1.8) * 0.09;
        giftRoot.rotation.y += delta * 0.32;

        // Only after 15 seconds (when music reaches ~15s), launch gift box flying away
        if (musicElapsed >= MUSIC_DURATION_SEC) {
          animPhase = 'flyingAway';
          flyElapsed = 0;
        }
      } else if (animPhase === 'flyingAway') {
        // Gift box flies away upward/into distance and shrinks to 0
        flyElapsed += delta;
        const t = Math.min(flyElapsed / flyDuration, 1);
        const easeIn = t * t;

        giftRoot.position.y += delta * (4.5 + easeIn * 18.0);
        giftRoot.position.z -= delta * (4.0 + easeIn * 16.0);
        giftRoot.rotation.y += delta * 7.5;
        giftRoot.rotation.x -= delta * 3.8;

        const scale = Math.max(1 - easeIn, 0);
        giftRoot.scale.setScalar(scale);

        innerLight.intensity = (1 - t) * 5.2;
        glowBeamMat.opacity = (1 - t) * 0.3;

        if (t >= 1) {
          giftRoot.visible = false;
          animPhase = 'pictureHold';
          pictureElapsed = 0;
          setPhase('picture');

          // Step 3: Immediate festive fireworks alongside pickture.jpg
          spawnSkyBurst();
          spawnSkyBurst();
          spawnSkyBurst();
          spawnSkyShower();
          spawnSkyShower();
        }
      } else if (animPhase === 'pictureHold') {
        // Step 3: Hold pickture.jpg + fireworks for exactly 10 seconds
        pictureElapsed += delta;

        burstTimer += delta;
        if (burstTimer >= 0.6) {
          burstTimer = 0;
          spawnSkyBurst();
          if (Math.random() < 0.45) {
            spawnSkyBurst();
          }
        }

        showerTimer += delta;
        if (showerTimer >= 0.48) {
          showerTimer = 0;
          spawnSkyShower();
        }

        if (pictureElapsed >= PICTURE_HOLD_SEC) {
          animPhase = 'windBlow';
          windElapsed = 0;
          setPhase('wind');
          spawnWindGust();
          spawnWindGust();
        }
      } else if (animPhase === 'windBlow') {
        // Step 4: Strong wind blows image, title, and fireworks off-screen
        windElapsed += delta;
        if (windElapsed >= WIND_DURATION_SEC) {
          animPhase = 'message';
          setPhase('message');
        }
      }

      // Update all particles (apply extra wind push during 'windBlow')
      const isWindy = animPhase === 'windBlow';
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.life += delta;
        const posAttr = b.points.geometry.getAttribute('position');
        const arr = posAttr.array;

        for (let j = 0; j < arr.length; j += 3) {
          if (isWindy) {
            b.velocities[j] += 18.0 * delta;
            b.velocities[j + 1] += 2.2 * delta;
          }
          arr[j] += b.velocities[j] * delta;
          arr[j + 1] += b.velocities[j + 1] * delta;
          arr[j + 2] += b.velocities[j + 2] * delta;

          b.velocities[j] *= b.drag;
          b.velocities[j + 1] = b.velocities[j + 1] * b.drag - b.gravity * delta;
          b.velocities[j + 2] *= b.drag;
        }
        posAttr.needsUpdate = true;

        const lifeRatio = b.life / b.maxLife;
        b.points.material.opacity = Math.max(1 - lifeRatio * lifeRatio, 0);

        if (b.life >= b.maxLife) {
          fireworksGroup.remove(b.points);
          b.points.geometry.dispose();
          b.points.material.dispose();
          bursts.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateCameraLayout);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="h-dvh w-screen overflow-hidden select-none relative bg-[radial-gradient(ellipse_at_top,_#1e1348_0%,_#0b0820_52%,_#04020a_100%)]">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {/* Top-right Sound Toggle Button */}
      <button
        type="button"
        onClick={toggleAudio}
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
        title={isMuted ? 'Unmute audio' : 'Mute audio'}
        className="absolute top-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-amber-200 backdrop-blur-md transition hover:scale-105 hover:bg-white/20 active:scale-95 cursor-pointer"
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Step 2 & 3: Opening Happy Birthday Title -> Blows Away in Step 4 */}
      {(phase === 'opened' || phase === 'picture' || phase === 'wind') && (
        <div className="pointer-events-none absolute inset-x-0 top-[6%] sm:top-[8%] z-20 flex flex-col items-center px-4 text-center">
          <div
            className={
              phase === 'wind' ? 'animate-wind-blow' : 'animate-rise-greeting'
            }
          >
            <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-black tracking-wider bg-gradient-to-b from-amber-100 via-yellow-300 to-amber-500 bg-clip-text text-transparent animate-neon-gold drop-shadow-2xl">
              HAPPY BIRTHDAY
            </h1>
            <p className="mt-2 sm:mt-3 text-sm sm:text-lg md:text-xl font-semibold tracking-wide text-pink-100/95 drop-shadow-[0_0_12px_rgba(255,150,200,0.85)]">
              Wishing you joy, laughter, and magic! ✨
            </p>
          </div>
        </div>
      )}

      {/* Step 3: pickture.jpg Reveal (Held for 10s) -> Blows Away in Step 4 */}
      {(phase === 'picture' || phase === 'wind') && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 pt-24 sm:pt-28 pb-8">
          <div
            className={
              phase === 'wind'
                ? 'animate-wind-blow'
                : 'animate-message-reveal'
            }
          >
            <div className="rounded-3xl border-2 border-amber-300/50 bg-white/10 p-2 sm:p-3 shadow-[0_0_45px_rgba(255,210,100,0.35)] backdrop-blur-md">
              {!imgError ? (
                <img
                  src={pictureUrl}
                  alt="Birthday Celebration"
                  onError={() => setImgError(true)}
                  className="max-h-[52dvh] max-w-[82vw] sm:max-w-[60vw] md:max-w-[460px] rounded-2xl object-contain shadow-2xl"
                />
              ) : (
                <div className="flex h-56 w-64 sm:h-64 sm:w-80 flex-col items-center justify-center rounded-2xl bg-[#160f33]/85 px-6 text-center text-amber-100">
                  <span className="text-4xl">🎂✨</span>
                  <p className="mt-3 text-sm sm:text-base font-semibold">
                    Celebrating Your Special Day!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Final ~150-Word English Birthday Message Card */}
      {phase === 'message' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-6 md:p-8">
          <div className="animate-message-reveal w-full max-w-2xl max-h-[82dvh] overflow-y-auto rounded-3xl border border-amber-200/25 bg-[#0e0a24]/75 px-5 py-6 sm:px-9 sm:py-8 shadow-[0_0_50px_rgba(255,215,100,0.18)] backdrop-blur-md">
            <h2 className="font-display text-center text-xl sm:text-2xl md:text-3xl font-bold tracking-wider bg-gradient-to-r from-amber-200 via-yellow-300 to-pink-200 bg-clip-text text-transparent">
              Happy Birthday ✨
            </h2>
            <div className="mx-auto my-3 sm:my-4 h-px w-24 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
            <p className="text-left sm:text-center text-[13.5px] leading-relaxed sm:text-base sm:leading-7 md:text-[17px] md:leading-8 font-medium text-slate-100/95">
              {BIRTHDAY_MESSAGE}
            </p>
          </div>
        </div>
      )}

      {/* Step 0: Circular "Getting Started" Button Blended With Night Sky + 5s Clockwise Ring */}
      {(phase === 'intro' || phase === 'introLoading' || phase === 'introExit') && (
        <div
          className={`absolute inset-0 z-25 flex items-center justify-center px-4 ${
            phase === 'introExit' ? 'animate-intro-exit pointer-events-none' : ''
          }`}
        >
          <button
            type="button"
            onClick={handleGetStarted}
            disabled={phase !== 'intro'}
            className="group relative flex h-40 w-40 sm:h-44 sm:w-44 aspect-square items-center justify-center rounded-full bg-[#0a071c]/45 shadow-[0_0_32px_rgba(168,85,247,0.16),0_0_20px_rgba(251,191,36,0.12)] backdrop-blur-md transition-transform duration-300 hover:scale-105 hover:bg-[#120d2e]/55 active:scale-95 cursor-pointer disabled:cursor-default disabled:hover:scale-100"
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
              viewBox="0 0 156 156"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="ringGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="50%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f472b6" />
                </linearGradient>
              </defs>
              {/* Subtle thin idle border blended into the night sky */}
              <circle
                cx="78"
                cy="78"
                r="70"
                fill="none"
                stroke="rgba(255, 230, 175, 0.14)"
                strokeWidth="1.75"
              />
              {/* Single clockwise 360deg sweep over 5s when clicked */}
              {(phase === 'introLoading' || phase === 'introExit') && (
                <circle
                  cx="78"
                  cy="78"
                  r="70"
                  fill="none"
                  stroke="url(#ringGlowGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="animate-clockwise-ring-5s drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]"
                />
              )}
            </svg>
            <span className="relative z-10 flex flex-col items-center justify-center px-3 text-center">
              <span className="text-xl sm:text-2xl text-amber-300 mb-1">✨</span>
              <span className="font-display text-sm sm:text-base font-bold tracking-wider text-amber-100 leading-tight">
                Getting Started
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Step 1: Pulsing Hint Text Below the Gift Box */}
      {phase === 'idle' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 sm:bottom-12 z-20 flex justify-center px-4">
          <p className="animate-pulse rounded-full border border-amber-300/30 bg-black/35 px-5 py-2 text-sm sm:text-base font-medium tracking-wide text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.25)] backdrop-blur-sm">
            Tap the gift box to open
          </p>
        </div>
      )}
    </div>
  );
}
