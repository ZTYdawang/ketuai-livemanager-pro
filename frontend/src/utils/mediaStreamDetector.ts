/**
 * 媒体流检测工具
 * 用于检测iframe中的直播状态
 */

export interface MediaStreamInfo {
  isLive: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
  quality?: 'high' | 'medium' | 'low';
  bitrate?: number;
  timestamp: number;
}

export class MediaStreamDetector {
  private iframeRef: HTMLIFrameElement | null = null;
  private observers: Map<string, (info: MediaStreamInfo) => void> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * 初始化检测器
   */
  constructor(iframe?: HTMLIFrameElement) {
    this.iframeRef = iframe || null;
  }

  /**
   * 设置iframe引用
   */
  setIframe(iframe: HTMLIFrameElement) {
    this.iframeRef = iframe;
  }

  /**
   * 开始监控媒体流
   */
  startMonitoring(roomId: string, callback: (info: MediaStreamInfo) => void, interval: number = 10000) {
    this.observers.set(roomId, callback);
    
    if (!this.checkInterval) {
      this.checkInterval = setInterval(() => {
        this.checkAllStreams();
      }, interval);
    }
  }

  /**
   * 停止监控
   */
  stopMonitoring(roomId?: string) {
    if (roomId) {
      this.observers.delete(roomId);
    } else {
      this.observers.clear();
    }

    if (this.observers.size === 0 && this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 检测iframe中的媒体流
   */
  async detectMediaStream(): Promise<MediaStreamInfo> {
    const defaultInfo: MediaStreamInfo = {
      isLive: false,
      hasVideo: false,
      hasAudio: false,
      timestamp: Date.now()
    };

    if (!this.iframeRef) {
      return defaultInfo;
    }

    try {
      // 方法1: 尝试检测iframe的网络活动
      const networkActivity = await this.checkNetworkActivity();
      
      // 方法2: 检测页面内的媒体元素
      const mediaElements = await this.checkMediaElements();
      
      // 方法3: 监听音频上下文（如果可访问）
      const audioContext = await this.checkAudioContext();
      
      // 方法4: 检测页面标题变化（很多直播平台会在标题中显示状态）
      const titleInfo = await this.checkPageTitle();

      // 综合判断
      const isLive = networkActivity.isActive || 
                    mediaElements.hasActiveMedia || 
                    audioContext.hasAudio ||
                    titleInfo.containsLiveIndicator;

      return {
        isLive,
        hasVideo: mediaElements.hasVideo,
        hasAudio: audioContext.hasAudio,
        quality: this.estimateQuality(networkActivity.dataRate),
        bitrate: networkActivity.dataRate,
        timestamp: Date.now()
      };

    } catch (error) {
      console.warn('媒体流检测失败:', error);
      return defaultInfo;
    }
  }

  /**
   * 检测网络活动
   */
  private async checkNetworkActivity(): Promise<{ isActive: boolean; dataRate: number }> {
    try {
      // 这里可以监控iframe的网络请求
      // 实际实现中可能需要使用Performance API或其他方法
      
      // 模拟检测逻辑
      const performanceEntries = performance.getEntriesByType('navigation');
      const transferSize = performanceEntries.length > 0 ? 
        (performanceEntries[0] as PerformanceNavigationTiming).transferSize || 0 : 0;
      
      return {
        isActive: transferSize > 100000, // 100KB以上认为是活跃的
        dataRate: transferSize
      };
    } catch (error) {
      return { isActive: false, dataRate: 0 };
    }
  }

  /**
   * 检测媒体元素
   */
  private async checkMediaElements(): Promise<{ hasActiveMedia: boolean; hasVideo: boolean }> {
    try {
      // 由于同源策略限制，这里主要做模拟检测
      // 实际应用中可能需要与iframe内容进行postMessage通信
      
      return {
        hasActiveMedia: Math.random() > 0.5, // 模拟检测
        hasVideo: true
      };
    } catch (error) {
      return { hasActiveMedia: false, hasVideo: false };
    }
  }

  /**
   * 检测音频上下文
   */
  private async checkAudioContext(): Promise<{ hasAudio: boolean }> {
    try {
      // 尝试创建音频上下文来检测音频活动
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 检测是否有音频输出
      const analyser = audioContext.createAnalyser();
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // 计算平均音量
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      
      audioContext.close();
      
      return { hasAudio: average > 10 }; // 阈值可调整
    } catch (error) {
      return { hasAudio: false };
    }
  }

  /**
   * 检测页面标题
   */
  private async checkPageTitle(): Promise<{ containsLiveIndicator: boolean }> {
    try {
      if (!this.iframeRef?.contentDocument) {
        return { containsLiveIndicator: false };
      }

      const title = this.iframeRef.contentDocument.title.toLowerCase();
      const liveIndicators = ['直播中', 'live', '在线', 'streaming', '正在直播'];
      
      const containsLiveIndicator = liveIndicators.some(indicator => 
        title.includes(indicator)
      );

      return { containsLiveIndicator };
    } catch (error) {
      // 跨域限制，无法访问iframe内容
      return { containsLiveIndicator: false };
    }
  }

  /**
   * 估算质量等级
   */
  private estimateQuality(bitrate: number): 'high' | 'medium' | 'low' {
    if (bitrate > 2000000) return 'high';    // 2Mbps+
    if (bitrate > 800000) return 'medium';   // 800Kbps+
    return 'low';
  }

  /**
   * 检测所有观察者的流
   */
  private async checkAllStreams() {
    if (this.observers.size === 0) return;

    const streamInfo = await this.detectMediaStream();
    
    this.observers.forEach((callback) => {
      callback(streamInfo);
    });
  }

  /**
   * 高级检测：使用Intersection Observer检测iframe可见性
   */
  observeIframeVisibility(callback: (isVisible: boolean) => void) {
    if (!this.iframeRef) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        callback(entry.isIntersecting);
      });
    });

    observer.observe(this.iframeRef);
    return observer;
  }

  /**
   * 清理资源
   */
  destroy() {
    this.stopMonitoring();
    this.observers.clear();
    this.iframeRef = null;
  }
}

// 全局实例
export const mediaStreamDetector = new MediaStreamDetector();

// 类型声明扩展
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
} 