const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    // ========== 在这里添加/修改音频列表 ==========
    // 支持本地音频和在线音频URL
    const audioFiles = ref([
      {
        id: 0,
        name: "默认白噪音",
        url: "./assets/哄睡白噪音.mp3",
      },
      {
        id: 1,
        name: "嘘声（推荐）",
        url: "./assets/06嘘声.aac",
      },
      {
        id: 2,
        name: "纯白噪音",
        url: "./assets/05纯白噪音.aac",
      },
      {
        id: 3,
        name: "大雨",
        url: "./assets/04大雨.aac",
      },
      {
        id: 4,
        name: "绿皮火车",
        url: "./assets/01绿皮火车.aac",
      },
      {
        id: 5,
        name: "雨天火车",
        url: "./assets/02雨天火车.aac",
      },
      {
        id: 6,
        name: "坐火车",
        url: "./assets/07坐火车.aac",
      },
      {
        id: 7,
        name: "雪国列车",
        url: "./assets/08雪国列车.aac",
      },
      {
        id: 8,
        name: "海上暴风雨",
        url: "./assets/03海上暴风雨.aac",
      },
      {
        id: 9,
        name: "柴火煮水",
        url: "./assets/09柴火煮水.aac",
      },
      {
        id: 10,
        name: "水疗",
        url: "./assets/13水疗.aac",
      },
      {
        id: 11,
        name: "夏夜",
        url: "./assets/10夏夜.aac",
      },
      {
        id: 12,
        name: "露营",
        url: "./assets/11露营.aac",
      },
      {
        id: 13,
        name: "露营小雨",
        url: "./assets/12露营小雨.aac",
      },
      {
        id: 14,
        name: "小鸭子",
        url: "./assets/14小鸭子.aac",
      },
      {
        id: 15,
        name: "吹风机",
        url: "./assets/15吹风机.aac",
      },
      {
        id: 16,
        name: "钢琴雨声",
        url: "./assets/16钢琴曲+雨声.aac",
      },
    ]);

    const currentTrack = ref(null);
    const audioElement = ref(null);
    const volume = ref(0.7);
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const wakeLock = ref(null);
    const timerEndTime = ref(null);
    const timerHours = ref(0);
    const timerMinutes = ref(30);
    const isDarkMode = ref(false);
    const isFadeOutMode = ref(false);
    const showFadeOutInfo = ref(false);
    const remainingTimeDisplay = ref("");
    let timerId = null;
    let fadeOutTimerId = null;
    const originalVolume = ref(0.7);

    // ========== iOS 设备检测 ==========
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // ========== 淡出模式配置 ==========
    const FADE_OUT_CONFIG = {
      duration: 3 * 60 * 1000, // 淡出总时长: 3分钟(毫秒)
      stepInterval: 10 * 1000, // 每步间隔: 10秒(毫秒)
      title: "淡出模式",
      tip: "淡出模式将在最后3分钟内逐步降低音量,避免音乐突然停止吓到宝宝",
      detail: "最后3分钟内,每10秒逐渐降低音量",
    };

    // 初始化音频元素
    onMounted(() => {
      audioElement.value = new Audio();
      audioElement.value.loop = true;
      audioElement.value.volume = volume.value;

      // 音频事件监听
      audioElement.value.addEventListener("timeupdate", updateProgress);
      audioElement.value.addEventListener("loadedmetadata", () => {
        duration.value = audioElement.value.duration;
      });
      audioElement.value.addEventListener("play", () => {
        isPlaying.value = true;
      });
      audioElement.value.addEventListener("pause", () => {
        isPlaying.value = false;
      });

      // 页面可见性变化时处理播放
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("beforeunload", cleanup);

      // 加载保存的音量
      const savedVolume = localStorage.getItem("playerVolume");
      if (savedVolume !== null) {
        volume.value = parseFloat(savedVolume);
        audioElement.value.volume = volume.value;
      }

      // 加载保存的主题设置
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "dark") {
        isDarkMode.value = true;
        document.body.classList.add("dark-mode");
      }

      // 加载淡出模式设置
      const savedFadeOutMode = localStorage.getItem("fadeOutMode");
      if (savedFadeOutMode === "true") {
        isFadeOutMode.value = true;
      }

      // 加载上次播放的音频ID
      const savedTrackId = localStorage.getItem("lastPlayedTrack");
      if (savedTrackId !== null) {
        const trackId = parseInt(savedTrackId);
        const track = audioFiles.value.find((t) => t.id === trackId);
        if (track) {
          currentTrack.value = track;
          audioElement.value.src = track.url;
        }
      } else {
        // 默认选择 id: 0
        const defaultTrack = audioFiles.value.find((t) => t.id === 0);
        if (defaultTrack) {
          currentTrack.value = defaultTrack;
          audioElement.value.src = defaultTrack.url;
        }
      }
    });

    // 处理页面可见性变化
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isPlaying.value) {
        try {
          if (audioElement.value && audioElement.value.paused) {
            await audioElement.value.play();
          }
          await requestWakeLock();
        } catch (error) {
          console.log("自动播放被阻止");
        }
      }
    };

    // 请求屏幕常亮锁
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock.value = await navigator.wakeLock.request("screen");
          console.log("屏幕常亮已启用");
        }
      } catch (err) {
        console.log("屏幕常亮请求失败:", err);
      }
    };

    // 释放屏幕常亮锁
    const releaseWakeLock = async () => {
      if (wakeLock.value !== null) {
        try {
          await wakeLock.value.release();
          wakeLock.value = null;
        } catch (err) {
          console.log("释放屏幕常亮失败");
        }
      }
    };

    // 更新播放进度
    const updateProgress = () => {
      if (audioElement.value) {
        currentTime.value = audioElement.value.currentTime;
      }
    };

    // 格式化时间
    const formatTime = (seconds) => {
      if (!seconds || isNaN(seconds)) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    // 播放指定曲目
    const playTrack = async (track) => {
      try {
        currentTrack.value = track;
        audioElement.value.src = track.url;
        await audioElement.value.play();
        await requestWakeLock();

        // 保存当前播放的音频ID
        localStorage.setItem("lastPlayedTrack", track.id.toString());
      } catch (error) {
        console.error("播放失败:", error);
        alert("播放失败，请检查音频URL是否正确");
        return;
      }

      // 设置Media Session API（锁屏控制）- 失败不影响播放
      try {
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = {
            title: track.name,
            artist: "宝宝哄睡音频",
            album: "白噪音",
            artwork: [
              {
                src: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌙</text></svg>",
                sizes: "96x96",
                type: "image/svg+xml",
              },
              {
                src: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌙</text></svg>",
                sizes: "512x512",
                type: "image/svg+xml",
              },
            ],
          };

          navigator.mediaSession.setActionHandler("play", async () => {
            await audioElement.value.play();
          });

          navigator.mediaSession.setActionHandler("pause", async () => {
            audioElement.value.pause();
          });
        }
      } catch (error) {
        console.log("Media Session API 设置失败（不影响播放）:", error);
      }
    };

    // 切换播放/暂停
    const togglePlay = async () => {
      if (!currentTrack.value) {
        if (audioFiles.value.length > 0) {
          await playTrack(audioFiles.value[0]);
        }
        return;
      }

      try {
        if (isPlaying.value) {
          audioElement.value.pause();
          await releaseWakeLock();
        } else {
          await audioElement.value.play();
          await requestWakeLock();
        }
      } catch (error) {
        console.error("播放控制失败:", error);
      }
    };

    // 停止播放
    const stopPlay = () => {
      if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value.currentTime = 0;
      }
      releaseWakeLock();
    };

    // 调整音量
    const handleVolumeChange = (event) => {
      const newVolume = parseFloat(event.target.value);
      volume.value = newVolume;
      if (audioElement.value) {
        audioElement.value.volume = newVolume;
      }
      localStorage.setItem("playerVolume", newVolume.toString());
    };

    // 进度条拖动
    const seekTo = (event) => {
      if (audioElement.value && duration.value) {
        const percent = event.target.value;
        audioElement.value.currentTime = (percent / 100) * duration.value;
      }
    };

    // 清理资源
    const cleanup = () => {
      releaseWakeLock();
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    // 设置定时停止
    const setTimer = async () => {
      const totalMinutes = timerHours.value * 60 + timerMinutes.value;
      if (totalMinutes <= 0) {
        alert("请设置有效的时间");
        return;
      }

      const now = new Date();
      timerEndTime.value = new Date(now.getTime() + totalMinutes * 60000);

      // 显示定时提示
      const fadeOutTip = isFadeOutMode.value
        ? `\n(已启用淡出模式,最后${FADE_OUT_CONFIG.duration / 60000}分钟逐渐降低音量)`
        : "";
      // alert(`将在 ${timerHours.value}小时${timerMinutes.value}分钟后停止播放${fadeOutTip}`);

      // 清除之前的定时器
      if (timerId) {
        clearTimeout(timerId);
      }
      if (fadeOutTimerId) {
        clearTimeout(fadeOutTimerId);
      }

      const totalMilliseconds = totalMinutes * 60000;

      // 如果启用淡出模式,保存原始音量并设置淡出定时器
      if (isFadeOutMode.value) {
        originalVolume.value = volume.value;

        // 计算淡出开始时间(总时间 - 淡出时长)
        const fadeOutStartTime = totalMilliseconds - FADE_OUT_CONFIG.duration;

        // 设置淡出定时器
        fadeOutTimerId = setTimeout(() => {
          startFadeOut();
        }, fadeOutStartTime);
      }

      // 自动开始播放（如果还没有播放）
      if (!isPlaying.value) {
        try {
          if (!currentTrack.value && audioFiles.value.length > 0) {
            await playTrack(audioFiles.value[0]);
          } else if (currentTrack.value) {
            await audioElement.value.play();
            await requestWakeLock();
          }
        } catch (error) {
          console.error("自动播放失败:", error);
        }
      }

      // 启动主定时器（后台播放时也会执行）
      timerId = setTimeout(() => {
        if (audioElement.value && !audioElement.value.paused) {
          audioElement.value.pause();
          audioElement.value.currentTime = 0;
          isPlaying.value = false;
          releaseWakeLock();
          timerEndTime.value = null;
          timerId = null;

          // 恢复原始音量
          if (isFadeOutMode.value) {
            volume.value = originalVolume.value;
            if (audioElement.value) {
              audioElement.value.volume = originalVolume.value;
            }
          }
        }
      }, totalMilliseconds);
    };

    // 开始淡出
    const startFadeOut = () => {
      if (!audioElement.value) return;

      const steps = FADE_OUT_CONFIG.duration / FADE_OUT_CONFIG.stepInterval; // 计算总步数
      const volumeDecrement = originalVolume.value / steps; // 每步降低的音量
      let currentStep = 0;

      const fadeOutInterval = setInterval(() => {
        currentStep++;

        if (currentStep >= steps) {
          // 最后一步,设为0
          if (audioElement.value) {
            audioElement.value.volume = 0;
            volume.value = 0;
            //完成后需要将音量调整回来，可再下次使用
            setTimeout(() => {
              volume.value = originalVolume.value;
              audioElement.value.volume = originalVolume.value;
            }, 1000);
          }
          clearInterval(fadeOutInterval);
        } else {
          // 逐步降低音量
          const newVolume = originalVolume.value * (1 - currentStep / steps);
          if (audioElement.value) {
            audioElement.value.volume = newVolume;
            volume.value = newVolume;
          }
        }
      }, FADE_OUT_CONFIG.stepInterval);
    };

    // 取消定时
    const cancelTimer = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (fadeOutTimerId) {
        clearTimeout(fadeOutTimerId);
        fadeOutTimerId = null;
      }
      timerEndTime.value = null;

      // 如果在淡出过程中取消,恢复原始音量
      if (audioElement.value) {
        volume.value = originalVolume.value;
        audioElement.value.volume = originalVolume.value;
      }
    };

    // 在定时期间调整淡出模式
    const adjustFadeOutMode = () => {
      if (!timerEndTime.value) return; // 没有定时，不处理

      const now = new Date();
      const remainingTime = timerEndTime.value - now;

      // 如果剩余时间小于淡出时长，不允许关闭（已经在淡出中）
      if (remainingTime <= FADE_OUT_CONFIG.duration && fadeOutTimerId) {
        alert("淡出已经开始，无法关闭");
        return;
      }

      // 清除现有的淡出定时器
      if (fadeOutTimerId) {
        clearTimeout(fadeOutTimerId);
        fadeOutTimerId = null;
      }

      // 如果开启淡出模式且剩余时间足够
      if (isFadeOutMode.value && remainingTime > FADE_OUT_CONFIG.duration) {
        // 保存当前音量作为原始音量
        originalVolume.value = volume.value;

        // 计算淡出开始时间
        const fadeOutStartTime = remainingTime - FADE_OUT_CONFIG.duration;

        // 设置淡出定时器
        fadeOutTimerId = setTimeout(() => {
          startFadeOut();
        }, fadeOutStartTime);
      }
    };

    // 切换淡出模式
    const toggleFadeOutMode = () => {
      // 保存当前音量（在开启淡出时作为原始音量）
      if (!isFadeOutMode.value && audioElement.value) {
        originalVolume.value = volume.value;
      }

      isFadeOutMode.value = !isFadeOutMode.value;

      // 如果定时正在运行，调整淡出设置
      if (timerEndTime.value) {
        adjustFadeOutMode();
      }

      // 持久化保存淡出模式状态
      localStorage.setItem("fadeOutMode", isFadeOutMode.value.toString());
    };

    // 显示/隐藏淡出模式说明
    const toggleFadeOutInfo = () => {
      showFadeOutInfo.value = !showFadeOutInfo.value;
    };

    // 格式化剩余时间
    const getRemainingTime = () => {
      if (!timerEndTime.value) return "";
      const now = new Date();
      const diff = timerEndTime.value - now;
      if (diff <= 0) return "";

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    // 每秒更新剩余时间显示
    setInterval(() => {
      if (timerEndTime.value) {
        const now = new Date();
        if (now >= timerEndTime.value) {
          timerEndTime.value = null;
          remainingTimeDisplay.value = "";
        } else {
          // 更新响应式变量以触发视图刷新
          remainingTimeDisplay.value = getRemainingTime();
        }
      }
    }, 1000);

    // 切换主题
    const toggleTheme = () => {
      isDarkMode.value = !isDarkMode.value;
      if (isDarkMode.value) {
        document.body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
      } else {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
      }
    };

    return {
      audioFiles,
      currentTrack,
      volume,
      isPlaying,
      currentTime,
      duration,
      timerEndTime,
      timerHours,
      timerMinutes,
      isDarkMode,
      isFadeOutMode,
      showFadeOutInfo,
      FADE_OUT_CONFIG,
      playTrack,
      togglePlay,
      stopPlay,
      handleVolumeChange,
      formatTime,
      seekTo,
      setTimer,
      cancelTimer,
      getRemainingTime,
      toggleTheme,
      toggleFadeOutMode,
      toggleFadeOutInfo,
      remainingTimeDisplay,
      isIOS, // 暴露 iOS 检测结果给模板
    };
  },
  template: `
        <div class="player-container">
            <!-- 淡出模式说明弹窗 -->
            <div v-if="showFadeOutInfo" class="fadeout-modal" @click="toggleFadeOutInfo">
                <div class="fadeout-modal-content" @click.stop>
                    <div class="fadeout-modal-header">
                        <span class="fadeout-modal-icon">🌙</span>
                        <h3>{{ FADE_OUT_CONFIG.title }}</h3>
                    </div>
                    <div class="fadeout-modal-body">
                        <p>{{ FADE_OUT_CONFIG.tip }}</p>
                        <p class="fadeout-modal-detail">
                            {{ FADE_OUT_CONFIG.detail }}
                        </p>
                    </div>
                    <div class="fadeout-modal-footer">
                        <button class="fadeout-modal-btn" @click="toggleFadeOutInfo">知道了</button>
                    </div>
                </div>
            </div>
            <div class="header">
                <button class="theme-toggle" @click="toggleTheme" :title="isDarkMode ? '切换到明亮模式' : '切换到暗黑模式'">
                    <svg v-if="!isDarkMode" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0 1.41.996.996 0 0 0 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06z"/>
                    </svg>
                </button>
                <h1>🌙 助眠音频</h1>
                <p class="subtitle">单曲循环 · 后台播放 · 定时停止</p>
            </div>

            <div class="player-content">
                <!-- 当前播放信息 -->
                <div class="now-playing">
                    <div class="track-icon">
                        <div class="sound-wave" :class="{ playing: isPlaying }">
                            <span class="wave-bar"></span>
                            <span class="wave-bar"></span>
                            <span class="wave-bar"></span>
                            <span class="wave-bar"></span>
                            <span class="wave-bar"></span>
                        </div>
                    </div>
                    <div class="track-info">
                        <h2>{{ currentTrack ? currentTrack.name : '选择音频开始播放' }}</h2>
                        <p>{{ isPlaying ? '播放中' : '已暂停' }}</p>
                    </div>
                </div>

                <!-- 进度条 -->
                <div class="progress-container">
                    <span class="time">{{ formatTime(currentTime) }}</span>
                    <input
                        type="range"
                        class="progress-bar"
                        :value="duration ? (currentTime / duration * 100) : 0"
                        @input="seekTo"
                        min="0"
                        max="100"
                    >
                    <span class="time">{{ formatTime(duration) }}</span>
                </div>

                <!-- 控制按钮 -->
                <div class="controls">
                    <button class="control-btn" @click="stopPlay" title="停止">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12"/>
                        </svg>
                    </button>
                    <button class="control-btn play-btn" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
                        <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                    </button>
                </div>

                <!-- 音量控制 -->
                <div class="volume-control"  v-show="!isIOS">
                    <svg class="volume-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                    </svg>
                    <input
                        type="range"
                        class="volume-slider"
                        v-model="volume"
                        @input="handleVolumeChange"
                        min="0"
                        max="1"
                        step="0.01"
                    >
                    <span class="volume-value">{{ Math.round(volume * 100) }}%</span>
                </div>

                <!-- 定时停止 -->
                <div class="timer-section">
                    <div class="timer-header">
                        <span class="timer-icon">⏰</span>
                        <span class="timer-title">定时停止</span>
                        <span v-if="timerEndTime" class="timer-countdown">{{ remainingTimeDisplay }}</span>
                    </div>
                    <div v-if="!timerEndTime" class="timer-controls">
                        <select v-model="timerHours" class="timer-select">
                            <option :value="0">0小时</option>
                            <option :value="1">1小时</option>
                            <option :value="2">2小时</option>
                            <option :value="3">3小时</option>
                        </select>
                        <select v-model="timerMinutes" class="timer-select">
                            <option :value="5">5分钟</option>
                            <option :value="10">10分钟</option>
                            <option :value="15">15分钟</option>
                            <option :value="30">30分钟</option>
                            <option :value="45">45分钟</option>
                        </select>
                        <button class="timer-btn" @click="setTimer">开始定时</button>
                    </div>
                    <div v-else class="timer-active">
                        <button class="timer-btn cancel-btn" @click="cancelTimer">取消定时</button>
                    </div>

                    <!-- 淡出模式开关 - 只在开始定时后显示 -->
                    <div v-show="timerEndTime && !isIOS" class="fadeout-toggle">
                        <label class="fadeout-checkbox">
                            <input
                                type="checkbox"
                                :checked="isFadeOutMode"
                                @change="toggleFadeOutMode"
                            >
                            <span class="fadeout-text">
                                <span class="fadeout-icon">🌙</span>
                                淡出模式
                                <span class="fadeout-badge" v-if="isFadeOutMode">已启用</span>
                            </span>
                        </label>
                        <button class="fadeout-info-btn" @click="toggleFadeOutInfo" title="什么是淡出模式?">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- 播放提示 -->
                <div class="tips">
                    <p>💡 添加到主屏幕可获得更好的体验</p>
                    <p>🔒 支持锁屏播放和后台播放</p>
                    <p>🔄 当前曲目会单曲循环播放</p>
                </div>
            </div>

            <!-- 音频列表 -->
            <h3 class="playlistTitle">🎵 音频列表</h3>
            <div class="playlist">
                <div
                    v-for="track in audioFiles"
                    :key="track.id"
                    class="track-item"
                    :class="{ active: currentTrack && currentTrack.id === track.id }"
                    @click="playTrack(track)"
                >
                    <div class="track-info">
                        <span class="track-name">{{ track.name }}</span>
                        <!-- 
                        <span v-if="currentTrack && currentTrack.id === track.id && isPlaying" class="playing-indicator">
                            播放中
                        </span>
                         -->
                    </div>
                </div>
            </div>

            <!-- GitHub 链接 -->
            <div class="github-link">
                <a href="https://github.com/Elaina2003/help-sleep-player" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <span>GitHub: Elaina2003/help-sleep-player</span>
                </a>
                <p class="star-tip">如果这个项目对你有帮助，请点个 ⭐ Star 支持一下！</p>
            </div>
        </div>
    `,
}).mount("#app");
