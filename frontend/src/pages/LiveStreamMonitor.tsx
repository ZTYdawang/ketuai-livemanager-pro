import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Input, Row, Col, Space, Typography, Alert, Badge, Divider, Form, Modal, Select, Slider, Switch, Progress, message, Popconfirm, Tabs, Radio } from 'antd';
import { PlayCircleOutlined, StopOutlined, PauseCircleOutlined, VideoCameraOutlined, EyeOutlined, SettingOutlined, DeleteOutlined, EditOutlined, ClearOutlined, ReloadOutlined, CameraOutlined, ExperimentOutlined, CloudDownloadOutlined, FileAddOutlined } from '@ant-design/icons';
import Hls from 'hls.js';
import flvjs from 'flv.js';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface LiveRoom {
  id: string;
  url: string;
  title: string;
  streamer: string;
  category: string;
  status: 'live' | 'offline' | 'unknown';
  isRecording: boolean;
  isRecordingLoading?: boolean; // 增加一个加载状态
  lastCheck: string;
  recordingDuration?: number;
  thumbnailUrl?: string;
  totalRecordings: number;
}

interface RecordingSession {
  id: string;
  roomId: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'stopped' | 'error';
  filename?: string;
  fileSize?: number;
  duration?: number;
}

interface RecordingSettings {
  quality: 'high' | 'medium' | 'low';
  audioOnly: boolean;
  autoRecord: boolean;
  maxDuration: number; // 分钟
  autoStopOnOffline: boolean; // 主播下线时自动停止录制
  recordingMode: 'screen' | 'stream'; // 录制模式：屏幕录制或流录制
}

interface StreamRecordingFile {
  id: number;
  room_id: number;
  started_at: string;
  ended_at: string;
  filename: string;
  file_size: number;
  duration: number;
  quality: string;
  audio_only: boolean;
  status: string;
}

interface SystemStats {
  rooms: {
    total_rooms: number;
    live_rooms: number;
    recording_rooms: number;
  };
  recordings: {
    total_recordings: number;
    total_duration: number;
    total_size: number;
  };
}

interface PreviewSettings {
  mode: 'info' | 'screenshot' | 'hls' | 'flv' | 'webrtc' | 'pip';
  autoRefresh: boolean;
  refreshInterval: number;
}

const LiveStreamMonitor: React.FC = () => {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<LiveRoom | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    rooms: {
      total_rooms: 0,
      live_rooms: 0,
      recording_rooms: 0
    },
    recordings: {
      total_recordings: 0,
      total_duration: 0,
      total_size: 0
    }
  });
  const [loading, setLoading] = useState(false);
  const [recordingSettings, setRecordingSettings] = useState<RecordingSettings>({
    quality: 'medium',
    audioOnly: false,
    autoRecord: false,
    maxDuration: 120,
    autoStopOnOffline: true,
    recordingMode: 'screen'
  });
  
  // 录制会话管理
  const [activeRecordings, setActiveRecordings] = useState<Map<string, RecordingSession>>(new Map());
  const [recordingHistory, setRecordingHistory] = useState<RecordingSession[]>([]);
  
  // 流录制相关状态
  const [streamRecordingFiles, setStreamRecordingFiles] = useState<StreamRecordingFile[]>([]);
  const [isStreamRecordingModalOpen, setIsStreamRecordingModalOpen] = useState(false);
  
  // 录制模式选择模态框状态
  const [isRecordingModeModalOpen, setIsRecordingModeModalOpen] = useState(false);
  const [selectedRoomForRecording, setSelectedRoomForRecording] = useState<LiveRoom | null>(null);
  
  // 自动检测设置
  const [autoDetectionSettings, setAutoDetectionSettings] = useState({
    enabled: false,
    interval: 300, // 5分钟
    checkOnlySelected: false // 只检测选中的直播间
  });
  
  // 多直播间监看功能
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [multiViewMode, setMultiViewMode] = useState<'single' | 'grid2x2' | 'grid3x3' | 'grid4x4'>('single');
  const [multiViewSettings, setMultiViewSettings] = useState({
    syncPreviewMode: true, // 是否同步预览模式
    autoRotate: false, // 是否自动轮播
    rotateInterval: 10, // 轮播间隔（秒）
    showRoomInfo: true // 是否显示房间信息
  });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>({
    mode: 'info',
    autoRefresh: true,
    refreshInterval: 30
  });
  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [hlsUrl, setHlsUrl] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [hlsError, setHlsError] = useState<string>('');
  const [hlsSupported, setHlsSupported] = useState(false);
  
  // 添加FLV相关状态
  const [flvUrl, setFlvUrl] = useState<string>('');
  const [flvError, setFlvError] = useState<string>('');
  const [currentStreamType, setCurrentStreamType] = useState<'hls' | 'flv' | 'unknown'>('unknown');
  
  // 多画面FLV播放器管理
  const [multiViewFlvPlayers, setMultiViewFlvPlayers] = useState<Map<string, any>>(new Map());
  const [multiViewStreamUrls, setMultiViewStreamUrls] = useState<Map<string, string>>(new Map());
  
  // 防抖处理
  const lastLoadTimeRef = useRef<number>(0);
  const LOAD_DEBOUNCE_DELAY = 1000; // 1秒防抖

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenshotIntervalRef = useRef<NodeJS.Timeout>();
  const hlsRef = useRef<Hls | null>(null);
  // 添加FLV播放器ref
  const flvRef = useRef<any>(null);

  // 防抖加载函数
  const debouncedLoadRooms = useCallback(async (reason: string = '') => {
    const now = Date.now();
    if (now - lastLoadTimeRef.current < LOAD_DEBOUNCE_DELAY) {
      console.log(`🚫 防抖阻止重复加载 (${reason}), 距离上次: ${now - lastLoadTimeRef.current}ms`);
      return;
    }
    
    console.log(`🔄 执行数据加载 (${reason})`);
    lastLoadTimeRef.current = now;
    await loadRooms();
  }, []); // 移除依赖项，因为使用ref

  // 初始化数据加载
  useEffect(() => {
    debouncedLoadRooms('页面初始化');
  }, []); // 只在组件挂载时执行一次

  // 优化的localStorage监听器 - 只在真正需要时才刷新
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // 只监听特定的key变化，并且要确保是真正的变化
      if (e.key === 'stream_monitor_rooms' && e.oldValue !== e.newValue) {
        console.log('🔄 检测到跨页面localStorage变化');
        debouncedLoadRooms('跨页面localStorage变化');
      }
    };

    // 只监听跨页面的storage事件
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [debouncedLoadRooms]);

  // 获取认证头
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  // 重构后的统一数据加载函数
  const loadRooms = async () => {
    try {
      setLoading(true);
      
      // 步骤1: 并行获取房间列表和活跃录制状态
      const [roomsResponse, activeRecordingsResponse] = await Promise.all([
        fetch('/api/rooms', { headers: getAuthHeaders() }),
        fetch('/api/stream-monitor/active-recordings', { headers: getAuthHeaders() })
      ]);

      // 步骤2: 处理活跃录制状态
      const newActiveRecordingsMap = new Map<string, RecordingSession>();
      if (activeRecordingsResponse.ok) {
        const recordingsData = await activeRecordingsResponse.json();
        if (recordingsData.success && recordingsData.data) {
          console.log('📹 从后端加载活跃录制状态:', recordingsData.data);
          Object.entries(recordingsData.data).forEach(([roomId, recordingInfo]: [string, any]) => {
            const session: RecordingSession = {
              id: recordingInfo.recordingId || `session_${roomId}_${Date.now()}`,
              roomId: roomId,
              startTime: new Date(recordingInfo.startTime),
              status: recordingInfo.status,
              filename: recordingInfo.filename
            };
            newActiveRecordingsMap.set(roomId, session);
          });
        }
      } else {
        console.error('加载活跃录制状态失败:', activeRecordingsResponse.statusText);
      }
      // 更新全局的 active recordings state
      setActiveRecordings(newActiveRecordingsMap);

      // 步骤3: 处理房间列表
      if (roomsResponse.ok) {
        const roomsResult = await roomsResponse.json();
        if (roomsResult.success && Array.isArray(roomsResult.data)) {
          const monitoredDbRooms = roomsResult.data.filter((room: any) => room.is_monitored === 1);
          
          // 步骤4: 使用最新的录制状态映射房间列表
          const monitorList: LiveRoom[] = monitoredDbRooms.map((room: any) => ({
            id: String(room.id),
            url: room.url,
            title: room.title,
            streamer: room.streamer,
            category: room.platform || '娱乐',
            status: 'unknown',
            // 使用最新的 map (local variable) 来判断
            isRecording: newActiveRecordingsMap.has(String(room.id)), 
            lastCheck: '从未检测',
            recordingDuration: 0,
            totalRecordings: 0,
          }));

          setRooms(monitorList);
          
        } else {
           console.warn('⚠️ 从数据库加载房间失败:', roomsResult.message);
           message.error('加载监控房间列表失败');
        }
      } else {
        console.warn('⚠️ 从数据库加载房间失败，HTTP状态:', roomsResponse.status);
        message.error('加载监控房间列表失败');
      }
      
      // 加载其他统计数据
      await loadSystemStats();
      
    } catch (error) {
      console.error('❌ 加载直播间列表或录制状态失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 新增：加载活跃录制状态 - 这个函数将被移除，因为它的功能已经被合并到 loadRooms 中
  const loadActiveRecordings = async () => {
    // ... 移除这个函数的内容 ...
  };

  // 加载系统统计
  const loadSystemStats = async () => {
    try {
      const response = await fetch('/api/stream-monitor/stats', {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data) {
          // 确保数据结构正确
          const statsData = {
            rooms: {
              total_rooms: data.data.rooms?.total_rooms || 0,
              live_rooms: data.data.rooms?.live_rooms || 0,
              recording_rooms: data.data.rooms?.recording_rooms || 0
            },
            recordings: {
              total_recordings: data.data.recordings?.total_recordings || 0,
              total_duration: data.data.recordings?.total_duration || 0,
              total_size: data.data.recordings?.total_size || 0
            }
          };
          setSystemStats(statsData);
        } else {
          console.warn('系统统计API返回格式不正确:', data);
        }
      } else {
        console.warn('获取系统统计失败，HTTP状态:', response.status);
      }
    } catch (error) {
      console.error('加载系统统计失败:', error);
      // 不显示错误消息，保持默认值即可
    }
  };

  // 改进的开始录制函数 - 支持流录制模式
  const startRecording = async (room: LiveRoom, modeOverride?: 'screen' | 'stream') => {
    if (activeRecordings.has(room.id)) {
      message.warning('该直播间已在录制中');
      return;
    }

    const modeToUse = modeOverride || recordingSettings.recordingMode;
    console.log('🎬 开始录制直播间:', room.title, '模式:', modeToUse);

    try {
      // 步骤1: 设置加载状态，而不是乐观更新
      setRooms(prev => prev.map(r =>
        r.id === room.id ? { ...r, isRecordingLoading: true } : r
      ));

      if (modeToUse === 'stream') {
        // 步骤2: 等待API调用完成
        await startStreamRecording(room);
      } else {
        await startScreenRecording(room);
      }

      // 步骤3: API调用成功后，强制从后端刷新状态
      await debouncedLoadRooms('开始录制后状态同步');

    } catch (error) {
      // 步骤4: 错误处理
      console.error('开始录制失败:', error);
      const errorMessage = error instanceof Error ? error.message : '请确保允许必要的权限';
      message.error(`录制失败: ${errorMessage}`);
    } finally {
      // 步骤5: 无论成功与否，都清除加载状态
      setRooms(prev => prev.map(r =>
        r.id === room.id ? { ...r, isRecordingLoading: false } : r
      ));
    }
  };

  // 新增：基于流的录制功能 (简化版)
  const startStreamRecording = async (room: LiveRoom) => {
    try {
      console.log('🎬 请求后端开始流录制:', room.title);

      // 此函数的唯一职责是调用API
      const response = await fetch(`/api/stream-monitor/rooms/${room.id}/stream-recording/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          quality: recordingSettings.quality,
          audioOnly: recordingSettings.audioOnly,
          maxDuration: recordingSettings.maxDuration
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '启动流录制失败');
      }

      const result = await response.json();
      
      // 不再更新本地状态，只显示成功消息
      const filename = result.data?.tempFilepath?.split(/\\|\//).pop() || '录制任务';
      message.success(`后端已成功启动: ${filename}`);
      
      // 不再调用 loadStreamRecordingFiles，由全局刷新统一处理

    } catch (error) {
      // 仅向上抛出错误
      throw error;
    }
  };

  // 屏幕录制函数（保持原有逻辑但重命名）
  const startScreenRecording = async (room: LiveRoom) => {
    try {
      // 先通知后端开始录制
      const response = await fetch(`/api/stream-monitor/rooms/${room.id}/recording/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          quality: recordingSettings.quality,
          audioOnly: recordingSettings.audioOnly
        }),
      });

      if (!response.ok) {
        throw new Error('启动录制记录失败');
      }

      // 创建录制会话
      const session: RecordingSession = {
        id: `session_${room.id}_${Date.now()}`,
        roomId: room.id,
        startTime: new Date(),
        status: 'recording'
      };

      // 更新录制会话状态
      setActiveRecordings(prev => new Map(prev.set(room.id, session)));

      // 根据录制设置选择录制方式
      if (recordingSettings.audioOnly) {
        await startAudioRecording(room, session);
      } else {
        await startScreenShareRecording(room, session);
      }

      // 自动停止录制（根据设置）
      if (recordingSettings.maxDuration > 0) {
        setTimeout(() => {
          stopRecording(room.id);
        }, recordingSettings.maxDuration * 60 * 1000);
      }

      message.success('开始屏幕录制');
      
    } catch (error) {
      console.error('屏幕录制启动失败:', error);
      throw error;
    }
  };

  // 重命名原有的屏幕录制函数
  const startScreenShareRecording = async (room: LiveRoom, session: RecordingSession) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 }
        },
        audio: true
      });
      
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // 生成文件名
        const filename = `${room.streamer}_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`;
        
        // 计算录制时长
        const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
        
        // 更新录制会话
        const completedSession: RecordingSession = {
          ...session,
          endTime: new Date(),
          status: 'stopped',
          filename,
          fileSize: blob.size,
          duration
        };
        
        // 添加到录制历史
        setRecordingHistory(prev => [completedSession, ...prev]);
        
        // 下载录制文件
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        
        // 通知后端停止录制
        try {
          await fetch(`/api/stream-monitor/rooms/${room.id}/recording/stop`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              filename,
              fileSize: blob.size,
              duration
            }),
          });
        } catch (error) {
          console.error('停止录制记录失败:', error);
        }
        
        message.success(`录制完成: ${filename} (${Math.floor(duration/60)}分${duration%60}秒)`);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // 每秒保存一次数据
      
      // 监听用户停止屏幕共享
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('🛑 用户停止了屏幕共享');
        stopRecording(room.id);
      });
      
    } catch (error) {
      console.error('屏幕录制启动失败:', error);
      throw error;
    }
  };

  // 音频录制
  const startAudioRecording = async (room: LiveRoom, session: RecordingSession) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        
        const filename = `${room.streamer}_audio_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`;
        const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
        
        const completedSession: RecordingSession = {
          ...session,
          endTime: new Date(),
          status: 'stopped',
          filename,
          fileSize: blob.size,
          duration
        };
        
        setRecordingHistory(prev => [completedSession, ...prev]);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        
        try {
          await fetch(`/api/stream-monitor/rooms/${room.id}/recording/stop`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              filename,
              fileSize: blob.size,
              duration
            }),
          });
        } catch (error) {
          console.error('停止录制记录失败:', error);
        }
        
        message.success(`音频录制完成: ${filename}`);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      
    } catch (error) {
      console.error('音频录制启动失败:', error);
      throw error;
    }
  };

  // 加载流录制文件列表
  const loadStreamRecordingFiles = async (roomId?: string) => {
    try {
      const url = roomId 
        ? `/api/stream-monitor/recordings?roomId=${roomId}`
        : '/api/stream-monitor/recordings';
        
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setStreamRecordingFiles(data.data || []);
      }
    } catch (error) {
      console.error('加载录制文件失败:', error);
    }
  };

  // 下载录制文件
  const downloadRecordingFile = async (filename: string) => {
    try {
      const response = await fetch(`/api/stream-monitor/recordings/${filename}/download`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        message.success('下载开始');
      } else {
        message.error('下载失败');
      }
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败');
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // 在组件挂载时加载录制文件
  useEffect(() => {
    loadStreamRecordingFiles();
  }, []);

  // 改进的停止录制函数 - 支持流录制
  const stopRecording = async (roomId?: string) => {
    try {
      // 如果没有指定roomId，停止所有录制
      const roomsToStop = roomId ? [roomId] : Array.from(activeRecordings.keys());

      for (const id of roomsToStop) {
        const session = activeRecordings.get(id);
        if (!session) continue;

        console.log('🛑 停止录制:', id);

        // 根据录制模式停止录制
        if (recordingSettings.recordingMode === 'stream') {
          // 停止流录制
          try {
            const response = await fetch(`/api/stream-monitor/rooms/${id}/stream-recording/stop`, {
              method: 'POST',
              headers: getAuthHeaders(),
            });

            if (response.ok) {
              message.success('流录制已停止');
              loadStreamRecordingFiles(); // 刷新录制文件列表
            } else {
              const errorData = await response.json();
              message.error(`停止流录制失败: ${errorData.error || '未知错误'}`);
            }
          } catch (error) {
            console.error('停止流录制失败:', error);
            message.error('停止流录制失败');
          }
        } else {
          // 停止屏幕录制
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }

          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          // 通知后端停止屏幕录制
          try {
            await fetch(`/api/stream-monitor/rooms/${id}/recording/stop`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                filename: session.filename || `recording_${id}_${new Date().toISOString()}`,
                fileSize: 0,
                duration: Math.floor((Date.now() - session.startTime.getTime()) / 1000)
              }),
            });
          } catch (error) {
            console.error('停止录制记录失败:', error);
          }
        }

        // 清理录制会话
        setActiveRecordings(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });

        // 更新房间状态 - 确保状态正确同步
        setRooms(prev => prev.map(r => 
          r.id === id ? { ...r, isRecording: false } : r
        ));

        // 后端录制状态由 streamRecorder 服务管理，
        // 调用停止录制API后，服务会自动更新状态。
        // 前端通过下方的 `debouncedLoadRooms` 自动刷新来获取最新状态。
      }

      if (!roomId) {
        message.success('所有录制已停止');
      }

      // 重新加载房间状态确保同步
      setTimeout(() => {
        debouncedLoadRooms('停止录制后状态同步');
      }, 1000);

    } catch (error) {
      console.error('停止录制失败:', error);
      message.error('停止录制失败');
    }
  };

  // 改进的定期检测逻辑 - 只有用户启用时才运行
  useEffect(() => {
    if (!autoDetectionSettings.enabled) {
      return;
    }

    const interval = setInterval(async () => {
      console.log('🔍 自动检测直播间状态...');
      
      const roomsToCheck = autoDetectionSettings.checkOnlySelected && selectedRoom 
        ? [selectedRoom] 
        : rooms.filter(room => room.status !== 'unknown');

      if (roomsToCheck.length === 0) {
        return;
      }

      // 批量检测状态（避免频繁UI更新）
      const statusUpdates: { id: string; status: 'live' | 'offline' | 'unknown'; lastCheck: string }[] = [];
      
      for (const room of roomsToCheck) {
        try {
          // 这里可以调用后端API进行真实的状态检测
          // 目前使用模拟逻辑
          const isLive = Math.random() > 0.3; // 模拟70%概率直播中
          const newStatus = isLive ? 'live' : 'offline';
          
          statusUpdates.push({
            id: room.id,
            status: newStatus,
            lastCheck: new Date().toLocaleString()
          });

          // 如果设置了自动停止录制且主播下线
          if (recordingSettings.autoStopOnOffline && 
              newStatus === 'offline' && 
              room.isRecording &&
              activeRecordings.has(room.id)) {
            console.log('🛑 主播下线，自动停止录制:', room.title);
            stopRecording(room.id);
          }

        } catch (error) {
          console.warn('检测直播间状态失败:', room.title, error);
        }
      }

      // 批量更新状态，减少UI刷新次数
      if (statusUpdates.length > 0) {
        setRooms(prev => prev.map(room => {
          const update = statusUpdates.find(u => u.id === room.id);
          return update ? { ...room, ...update } : room;
        }));
      }

    }, autoDetectionSettings.interval * 1000);

    return () => clearInterval(interval);
  }, [autoDetectionSettings, selectedRoom, rooms, recordingSettings.autoStopOnOffline, activeRecordings]);

  // 删除直播间（实际上是"停止监控"）
  const deleteRoom = async (roomId: string) => {
    try {
      console.log('🗑️ 从监控中移除直播间:', roomId);

      // 步骤 1: 更新数据库，将 is_monitored 设置为 0
      const response = await fetch(`/api/rooms/${roomId}/monitor`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ is_monitored: false }), // 设置为不监控
      });

      if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '更新数据库中的监控状态失败');
      }

      // 步骤 2: 更新localStorage，以触发跨页面通信
      const storedRooms = JSON.parse(localStorage.getItem('stream_monitor_rooms') || '[]');
      const updatedStoredRooms = storedRooms.filter((r: any) => String(r.id) !== String(roomId));
      localStorage.setItem('stream_monitor_rooms', JSON.stringify(updatedStoredRooms));

      // 步骤 3: 更新当前页面的UI状态，立即移除卡片
      setRooms(prev => prev.filter(room => room.id !== roomId));

      if (selectedRoom?.id === roomId) {
          setSelectedRoom(null);
      }

      message.success('直播间已从监控列表中移除');

    } catch (error: any) {
        console.error('❌ 从监控中移除直播间失败:', error);
        message.error(`移除失败: ${error.message}`);
    }
  };

  // 清空所有直播间
  const clearAllRooms = async () => {
    try {
      console.log('🧹 开始清空所有直播间...');
      
      // 第一步：从数据库删除所有房间
      const deletePromises = rooms.map(async (room) => {
        try {
          const response = await fetch(`/api/stream-monitor/rooms/${room.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          
          if (response.ok) {
            console.log('✅ 数据库删除成功:', room.title);
          } else {
            console.warn('⚠️ 数据库删除失败:', room.title, response.status);
          }
        } catch (error) {
          console.warn('⚠️ 数据库删除异常:', room.title, error);
        }
      });
      
      // 等待所有删除操作完成
      await Promise.all(deletePromises);
      
      // 第二步：清空localStorage
      localStorage.removeItem('stream_monitor_rooms');
      
      // 第三步：清空本地状态
      setRooms([]);
      setSelectedRoom(null);
      
      message.success('已清空所有监控直播间');
    } catch (error) {
      console.error('❌ 清空直播间失败:', error);
      // 即使发生错误，也清空本地数据
      localStorage.removeItem('stream_monitor_rooms');
      setRooms([]);
      setSelectedRoom(null);
      message.warning('清空完成，但部分数据可能未从服务器删除');
    }
  };

  // 选择直播间
  const selectRoom = (room: LiveRoom) => {
    setSelectedRoom(room);
    console.log('📺 选择直播间:', room.title);
    
    // 可以在这里添加其他选择房间后的逻辑
    // 比如自动检测状态等
  };

  // 多选直播间管理
  const toggleRoomSelection = (roomId: string, multiSelect = false) => {
    if (multiSelect) {
      setSelectedRooms(prev => {
        const newSet = new Set(prev);
        if (newSet.has(roomId)) {
          newSet.delete(roomId);
        } else {
          newSet.add(roomId);
        }
        console.log('🎯 多选直播间:', Array.from(newSet).length, '个');
        return newSet;
      });
    } else {
      // 单选模式，清空之前的选择
      setSelectedRooms(new Set([roomId]));
      const room = rooms.find(r => r.id === roomId);
      if (room) {
        setSelectedRoom(room);
      }
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    console.log('🎯 执行全选操作, 当前房间数:', rooms.length, '已选择:', selectedRooms.size);
    
    // 确保房间列表不为空
    if (rooms.length === 0) {
      console.warn('⚠️ 房间列表为空，无法执行全选操作');
      return;
    }
    
    // 如果已经全选了，则取消全选
    if (selectedRooms.size === rooms.length) {
      console.log('🔄 取消全选，清空选择');
      setSelectedRooms(new Set());
    } else {
      // 否则全选所有房间
      const allRoomIds = rooms.map(r => r.id);
      const newSelectedRooms = new Set(allRoomIds);
      console.log('🔄 执行全选，选择房间数量:', newSelectedRooms.size, 'IDs:', allRoomIds);
      setSelectedRooms(newSelectedRooms);
    }
  };

  // 清空选择
  const clearSelection = () => {
    setSelectedRooms(new Set());
  };

  // 获取选中的直播间列表
  const getSelectedRoomsList = (): LiveRoom[] => {
    return rooms.filter(room => selectedRooms.has(room.id));
  };

  // 切换多画面模式
  const switchMultiViewMode = (mode: typeof multiViewMode) => {
    setMultiViewMode(mode);
    console.log('🔄 切换多画面模式:', mode);
    
    // 根据模式限制选择数量
    const maxRooms = mode === 'grid2x2' ? 4 : mode === 'grid3x3' ? 9 : mode === 'grid4x4' ? 16 : 1;
    
    if (selectedRooms.size > maxRooms) {
      const roomIds = Array.from(selectedRooms).slice(0, maxRooms);
      setSelectedRooms(new Set(roomIds));
      message.warning(`${mode}模式最多支持${maxRooms}个直播间，已自动调整选择`);
    }
  };

  // 自动轮播功能
  useEffect(() => {
    if (!multiViewSettings.autoRotate || multiViewMode === 'single' || selectedRooms.size <= 1) {
      return;
    }

    const interval = setInterval(() => {
      const selectedList = Array.from(selectedRooms);
      const availableRooms = rooms.filter(r => !selectedRooms.has(r.id));
      
      if (availableRooms.length > 0) {
        // 随机替换一个选中的直播间
        const randomSelectedIndex = Math.floor(Math.random() * selectedList.length);
        const randomAvailableIndex = Math.floor(Math.random() * availableRooms.length);
        
        const newSelectedRooms = new Set(selectedRooms);
        newSelectedRooms.delete(selectedList[randomSelectedIndex]);
        newSelectedRooms.add(availableRooms[randomAvailableIndex].id);
        
        setSelectedRooms(newSelectedRooms);
        console.log('🔄 自动轮播更新直播间选择');
      }
    }, multiViewSettings.rotateInterval * 1000);

    return () => clearInterval(interval);
  }, [multiViewSettings.autoRotate, multiViewSettings.rotateInterval, multiViewMode, selectedRooms, rooms]);

  // 检查HLS支持
  useEffect(() => {
    if (Hls.isSupported()) {
      setHlsSupported(true);
      console.log('✅ HLS.js 支持已启用');
    } else if (videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      setHlsSupported(true);
      console.log('✅ 原生HLS支持已检测');
    } else {
      setHlsSupported(false);
      console.warn('⚠️ 当前浏览器不支持HLS播放');
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 清理录制相关资源
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // 清理HLS资源
      cleanupHls();
      // 清理FLV资源
      cleanupFlv();
      // 清理多画面播放器
      cleanupMultiViewPlayers();
    };
  }, []);

  // 获取直播间截图
  const captureScreenshot = async (room: LiveRoom) => {
    try {
      setIsLoadingPreview(true);
      console.log('📸 尝试获取直播间截图...');
      
      // 方案1: 通过后端获取真实截图
      console.log('🔍 尝试获取真实截图...');
      try {
        const response = await fetch('/api/stream-monitor/screenshot', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            url: room.url,
            roomId: room.id
          })
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setScreenshotUrl(url);
          console.log('✅ 真实截图获取成功');
          message.success('已获取直播间实时截图');
          return;
        } else {
          const errorText = await response.text();
          console.warn('⚠️ 后端截图失败:', errorText);
          message.warning('获取真实截图失败，生成模拟截图');
        }
      } catch (error) {
        console.warn('⚠️ 服务端截图异常:', error);
        message.warning('后端服务异常，生成模拟截图');
      }
      
      // 方案2: 生成模拟截图作为备用
      console.log('🔄 切换到模拟截图模式...');
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 创建模拟的直播截图
          canvas.width = 640;
          canvas.height = 360;
          
          // 渐变背景
          const gradient = ctx.createLinearGradient(0, 0, 640, 360);
          gradient.addColorStop(0, '#667eea');
          gradient.addColorStop(1, '#764ba2');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 640, 360);
          
          // 添加文字
          ctx.fillStyle = 'white';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(room.title, 320, 180);
          
          ctx.font = '16px Arial';
          ctx.fillText(`主播: ${room.streamer}`, 320, 220);
          ctx.fillText(`${new Date().toLocaleTimeString()}`, 320, 250);
          
          // 添加状态标识
          ctx.fillStyle = room.status === 'live' ? '#52c41a' : '#ff4d4f';
          ctx.beginPath();
          ctx.arc(50, 50, 20, 0, 2 * Math.PI);
          ctx.fill();
          
          // 添加"演示"标识
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = '14px Arial';
          ctx.fillText('演示截图', 320, 300);
          
          // 转换为图片URL
          const dataUrl = canvas.toDataURL('image/png');
          setScreenshotUrl(dataUrl);
          console.log('✅ 模拟截图生成成功');
          message.info('已生成演示截图');
        }
      }
    } catch (error) {
      console.error('❌ 截图获取失败:', error);
      message.error('截图获取失败');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 改进的HLS流获取和播放
  const tryGetHlsStream = async (room: LiveRoom) => {
    try {
      setIsLoadingPreview(true);
      setHlsError('');
      console.log('🎬 尝试获取HLS流地址...');
      
      // 确保video元素已准备就绪
      await waitForVideoElement();
      console.log('✅ Video元素已准备就绪');

      console.log('🔍 尝试获取真实直播流...');
      try {
        const response = await fetch('/api/stream-monitor/stream-url', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            url: room.url,
            roomId: room.id,
            type: 'hls'
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.streamUrl) {
            console.log('✅ 获取真实直播流成功:', result.streamUrl);
            console.log('🎯 流类型:', result.type);
            console.log('📋 所有找到的流:', result.allUrls);
            
            if (result.type === 'hls' || result.streamUrl.includes('.m3u8')) {
              // HLS流，使用HLS.js
              await loadHlsStream(result.streamUrl);
            } else {
              console.log('⚠️ 检测到非HLS流格式，请使用对应的播放模式');
              setHlsError('检测到非HLS流格式，建议切换到FLV模式');
            }
            return;
          }
        }
        
        const errorData = await response.json().catch(() => ({ error: '解析响应失败' }));
        console.error('⚠️ 后端流解析失败:', errorData.error || '未知错误');
        throw new Error(errorData.error || '获取流地址失败');
        
      } catch (error: any) {
        console.error('⚠️ 服务端流解析异常:', error);
        throw error;
      }

    } catch (error: any) {
      console.log('🔄 切换到测试流模式...');
      setHlsError('');
      
      // 降级到测试流
      const testStreams = [
        'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        'https://live-par-2-abr.livepush.io/vod/bigbuckbunnyiphone_400.m3u8'
      ];

      for (const testStream of testStreams) {
        try {
          console.log('🔄 尝试测试流:', testStream);
          await loadHlsStream(testStream);
          console.log('✅ 测试流加载成功');
          break;
        } catch (testError) {
          console.log('❌ 测试流失败:', testError);
          continue;
        }
      }

    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 尝试获取FLV流地址
  const tryGetFlvStream = async (room: LiveRoom) => {
    try {
      setIsLoadingPreview(true);
      setFlvError('');
      console.log('🎬 尝试获取FLV流地址...');
      
      // 确保video元素已准备就绪
      await waitForVideoElement();
      console.log('✅ Video元素已准备就绪');

      console.log('🔍 尝试获取真实直播流...');
      try {
        const response = await fetch('/api/stream-monitor/stream-url', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            url: room.url,
            roomId: room.id,
            type: 'flv'
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.streamUrl) {
            console.log('✅ 获取真实直播流成功:', result.streamUrl);
            console.log('🎯 流类型:', result.type);
            console.log('📋 所有找到的流:', result.allUrls);
            
            if (result.type === 'flv' || result.streamUrl.includes('.flv')) {
              setFlvUrl(result.streamUrl);
              setCurrentStreamType('flv');
            } else if (result.type === 'hls' || result.streamUrl.includes('.m3u8')) {
              console.log('⚠️ 检测到HLS流格式，建议切换到HLS模式');
              setFlvError('检测到HLS流格式，建议切换到HLS模式');
            } else {
              console.log('⚠️ 检测到未知流格式，尝试作为FLV处理');
              setFlvUrl(result.streamUrl);
              setCurrentStreamType('flv');
            }
            return;
          }
        }
        
        const errorData = await response.json().catch(() => ({ error: '解析响应失败' }));
        console.error('⚠️ 后端流解析失败:', errorData.error || '未知错误');
        throw new Error(errorData.error || '获取流地址失败');
        
      } catch (error: any) {
        console.error('⚠️ 服务端流解析异常:', error);
        throw error;
      }

    } catch (error: any) {
      console.log('🔄 无法获取FLV流，建议尝试其他模式');
      setFlvError(`获取FLV流失败: ${error.message}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 等待video元素准备就绪
  const waitForVideoElement = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 最多等待5秒 (50 * 100ms)
      
      const checkElement = () => {
        if (videoRef.current) {
          console.log('✅ Video元素已准备就绪');
          resolve();
          return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('等待video元素超时'));
          return;
        }
        
        setTimeout(checkElement, 100);
      };
      
      checkElement();
    });
  };

  // 加载HLS流
  const loadHlsStream = async (streamUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) {
        reject(new Error('视频元素未找到'));
        return;
      }

      const video = videoRef.current;
      
      // 清理之前的HLS实例
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // 检查是否支持HLS.js
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxLoadingDelay: 4,
          maxBufferLength: 30,
          maxBufferSize: 60 * 1000 * 1000
        });
        
        hlsRef.current = hls;
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS manifest 解析成功');
          setHlsUrl(streamUrl);
          setCurrentStreamType('hls');
          resolve();
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ HLS错误:', event, data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setHlsError('网络错误，请检查网络连接');
                hls.startLoad(); // 尝试恢复
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setHlsError('媒体错误，流格式可能不受支持');
                hls.recoverMediaError(); // 尝试恢复媒体错误
                break;
              default:
                setHlsError('播放器错误，请稍后重试');
                reject(new Error(data.reason || '播放失败'));
                break;
            }
          }
        });
        
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        // 设置超时
        setTimeout(() => {
          if (!hlsUrl) {
            reject(new Error('加载超时'));
          }
        }, 10000); // 10秒超时
        
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari原生支持
        video.src = streamUrl;
        
        const onLoadedMetadata = () => {
          console.log('✅ 原生HLS加载成功');
          setHlsUrl(streamUrl);
          setCurrentStreamType('hls');
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          resolve();
        };
        
        const onError = (e: Event) => {
          console.error('❌ 原生HLS错误:', e);
          setHlsError('流加载失败，请检查流地址');
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(new Error('原生HLS播放失败'));
        };
        
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);
        
        // 设置超时
        setTimeout(() => {
          if (!hlsUrl) {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('原生HLS加载超时'));
          }
        }, 10000);
        
      } else {
        setHlsError('当前浏览器不支持HLS播放');
        reject(new Error('HLS不受支持'));
      }
    });
  };

  // 通过后端代理获取流地址
  const tryBackendProxy = async (originalStreamUrl: string): Promise<string> => {
    try {
      if (!selectedRoom) {
        throw new Error('未选择直播间');
      }

      console.log('🔄 通过后端代理获取FLV流...');
      
      const response = await fetch('/api/stream-monitor/proxy-stream', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          streamUrl: originalStreamUrl,
          roomUrl: selectedRoom.url,
          type: 'flv'
        })
      });

      if (response.ok) {
        // 注意：对于流媒体代理，我们返回代理API的URL而不是blob
        const proxyUrl = `/api/stream-monitor/proxy-stream`;
        
        // 为了区分不同的流，我们需要在URL中包含参数
        const proxyStreamUrl = `${proxyUrl}?streamUrl=${encodeURIComponent(originalStreamUrl)}&roomUrl=${encodeURIComponent(selectedRoom.url)}&type=flv&timestamp=${Date.now()}`;
        
        console.log('✅ 后端代理URL生成成功:', proxyStreamUrl);
        return proxyStreamUrl;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '后端代理请求失败');
      }
    } catch (error: any) {
      console.error('后端代理失败:', error);
      throw new Error(`后端代理失败: ${error.message}`);
    }
  };


  // 清理HLS资源
  const cleanupHls = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setHlsUrl('');
    setHlsError('');
  };

  // 清理FLV资源
  const cleanupFlv = () => {
    if (flvRef.current) {
      flvRef.current.destroy();
      flvRef.current = null;
    }
    setFlvUrl('');
    setFlvError('');
  };

  // 清理所有播放器资源
  const cleanupAllPlayers = () => {
    cleanupHls();
    cleanupFlv();
    cleanupMultiViewPlayers();
    setCurrentStreamType('unknown');
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.load();
    }
  };

  // 清理多画面播放器
  const cleanupMultiViewPlayers = () => {
    multiViewFlvPlayers.forEach((player, roomId) => {
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy();
          console.log(`🧹 清理多画面FLV播放器: ${roomId}`);
        } catch (error) {
          console.warn(`清理多画面FLV播放器失败: ${roomId}`, error);
        }
      }
    });
    setMultiViewFlvPlayers(new Map());
    setMultiViewStreamUrls(new Map());
  };

  // 为单个房间获取FLV流地址
  const getFlvStreamForRoom = async (room: LiveRoom): Promise<string | null> => {
    try {
      console.log(`🎬 获取房间 ${room.title} 的FLV流地址...`);
      
      const response = await fetch('/api/stream-monitor/stream-url', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          url: room.url,
          roomId: room.id,
          type: 'flv'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.streamUrl) {
          console.log(`✅ 获取房间 ${room.title} FLV流成功:`, result.streamUrl);
          return result.streamUrl;
        }
      }
      
      // 如果获取失败，尝试使用后端代理
      try {
        const proxyUrl = await tryBackendProxy(room.url);
        return proxyUrl;
      } catch (proxyError) {
        console.warn(`房间 ${room.title} 代理获取流地址也失败:`, proxyError);
        return null;
      }
    } catch (error) {
      console.error(`获取房间 ${room.title} FLV流失败:`, error);
      return null;
    }
  };

  // 为单个房间创建FLV播放器
  const createFlvPlayerForRoom = async (room: LiveRoom, videoElement: HTMLVideoElement): Promise<boolean> => {
    if (!videoElement) {
      console.warn(`[FLV] 房间 ${room.id} 的video元素不存在`);
      return false;
    }

    const streamUrl = await getFlvStreamForRoom(room);
    if (!streamUrl) {
      console.warn(`[FLV] 房间 ${room.id} 无法获取FLV流`);
      return false;
    }

    console.log(`[FLV] 准备为房间 ${room.id} 创建播放器，流地址: ${streamUrl}`);
    setMultiViewStreamUrls(prev => new Map(prev.set(room.id, streamUrl)));

    try {
      if (flvjs.isSupported()) {
        const player = flvjs.createPlayer({
          type: 'flv',
          url: streamUrl,
          isLive: true,
          hasAudio: true,
          hasVideo: true,
        });

        player.attachMediaElement(videoElement);
        player.load();
        player.play();
        
        console.log(`[FLV] 房间 ${room.id} 播放器创建成功`);
        
        // 存储播放器实例
        setMultiViewFlvPlayers(prev => new Map(prev.set(room.id, player)));
        
        return true;
      } else {
        console.error(`[FLV] 浏览器不支持FLV`);
        return false;
      }
    } catch (error) {
      console.error(`[FLV] 房间 ${room.id} 创建播放器失败:`, error);
      return false;
    }
  };

  // 尝试WebRTC连接
  const tryWebRtcConnection = async (room: LiveRoom) => {
    try {
      setIsLoadingPreview(true);
      console.log('🌐 尝试WebRTC连接...');
      
      // 这里应该是WebRTC连接逻辑
      // 实际项目中需要信令服务器和STUN/TURN服务器
      
      message.info('WebRTC功能需要配置信令服务器，目前为演示模式');
      
    } catch (error) {
      console.error('❌ WebRTC连接失败:', error);
      message.error('WebRTC连接失败');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 画中画模式
  const tryPictureInPicture = async () => {
    try {
      if (videoRef.current) {
        if (document.pictureInPictureEnabled) {
          await videoRef.current.requestPictureInPicture();
          message.success('已启动画中画模式');
        } else {
          message.warning('当前浏览器不支持画中画功能');
        }
      }
    } catch (error) {
      console.error('❌ 画中画启动失败:', error);
      message.error('画中画启动失败');
    }
  };

  // 自动刷新截图
  useEffect(() => {
    if (previewSettings.autoRefresh && previewSettings.mode === 'screenshot' && selectedRoom) {
      screenshotIntervalRef.current = setInterval(() => {
        captureScreenshot(selectedRoom);
      }, previewSettings.refreshInterval * 1000);
    }

    return () => {
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
    };
  }, [previewSettings.autoRefresh, previewSettings.refreshInterval, previewSettings.mode, selectedRoom]);

  // 组件卸载时清理所有资源
  useEffect(() => {
    return () => {
      cleanupAllPlayers();
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
    };
  }, []);

  // 预览模式切换处理（更新）
  const handlePreviewModeChange = (mode: string) => {
    // 清理之前模式的资源
    if (previewSettings.mode === 'hls') {
      cleanupHls();
    }
    if (previewSettings.mode === 'flv') {
      cleanupFlv();
    }
    
    setPreviewSettings(prev => ({ ...prev, mode: mode as PreviewSettings['mode'] }));
    
    // 延迟执行以确保UI已更新
    setTimeout(() => {
      if (selectedRoom) {
        switch (mode) {
          case 'screenshot':
            captureScreenshot(selectedRoom);
            break;
          case 'hls':
            tryGetHlsStream(selectedRoom);
            break;
          case 'flv':
            tryGetFlvStream(selectedRoom);
            break;
          case 'webrtc':
            tryWebRtcConnection(selectedRoom);
            break;
          case 'pip':
            tryPictureInPicture();
            break;
          default:
            console.warn(`未知的预览模式: ${mode}`);
        }
      }
    }, 100); // 延迟100ms确保DOM更新
  };

  // 渲染预览内容
  const renderPreviewContent = () => {
    // 多画面模式处理
    if (multiViewMode !== 'single' && selectedRooms.size > 1) {
      return renderMultiViewContent();
    }

    if (!selectedRoom) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px', 
          color: '#999',
          border: '2px dashed #d9d9d9',
          borderRadius: '6px'
        }}>
          <EyeOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
          <br />
          请从左侧选择一个直播间进行监控
        </div>
      );
    }

    const { mode } = previewSettings;

    switch (mode) {
      case 'screenshot':
        return (
          <div style={{ 
            border: '1px solid #d9d9d9', 
            borderRadius: '6px', 
            overflow: 'hidden',
            position: 'relative',
            minHeight: '400px',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {screenshotUrl ? (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <img 
                  src={screenshotUrl} 
                  alt="直播截图"
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '400px',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                />
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  最后更新: {new Date().toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <CameraOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                <div style={{ marginBottom: '16px' }}>点击下方按钮获取直播截图</div>
                <Button 
                  type="primary" 
                  icon={<CameraOutlined />}
                  loading={isLoadingPreview}
                  onClick={() => captureScreenshot(selectedRoom)}
                >
                  获取截图
                </Button>
              </div>
            )}
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        );

      case 'hls':
        return (
          <div style={{ 
            border: '1px solid #d9d9d9', 
            borderRadius: '6px', 
            overflow: 'hidden',
            position: 'relative',
            minHeight: '400px',
            backgroundColor: '#000'
          }}>
            {hlsError ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '400px',
                color: 'white',
                textAlign: 'center',
                padding: '20px'
              }}>
                <Alert 
                  message="HLS播放错误" 
                  description={hlsError}
                  type="error" 
                  showIcon 
                  style={{ marginBottom: '16px', backgroundColor: 'rgba(255,255,255,0.9)' }}
                />
                <Space direction="vertical">
                  <Button 
                    type="primary" 
                    icon={<ReloadOutlined />}
                    onClick={async () => {
                      if (selectedRoom) {
                        setHlsError(''); // 清除之前的错误
                        await tryGetHlsStream(selectedRoom);
                      }
                    }}
                    loading={isLoadingPreview}
                  >
                    重试加载
                  </Button>
                  <Text style={{ color: '#ccc', fontSize: '12px' }}>
                    HLS.js支持: {hlsSupported ? '✅ 已启用' : '❌ 不支持'}
                  </Text>
                </Space>
              </div>
            ) : hlsUrl ? (
              <div style={{ position: 'relative' }}>
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  muted
                  style={{ width: '100%', height: '400px', backgroundColor: '#000' }}
                  poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkhMUyBTdHJlYW08L3RleHQ+PC9zdmc+"
                >
                  您的浏览器不支持视频播放
                </video>
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  🎬 HLS 流播放 | {hlsSupported ? 'HLS.js' : '原生'}
                </div>
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  display: 'flex',
                  gap: '8px'
                }}>
                  <Button
                    size="small"
                    onClick={tryPictureInPicture}
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
                  >
                    画中画
                  </Button>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={async () => {
                      if (selectedRoom) {
                        cleanupHls(); // 清理当前HLS实例
                        await tryGetHlsStream(selectedRoom);
                      }
                    }}
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
                  >
                    刷新
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '400px',
                color: 'white',
                textAlign: 'center'
              }}>
                <video
                  ref={videoRef}
                  style={{ display: 'none' }}
                >
                  您的浏览器不支持视频播放
                </video>
                <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div style={{ marginBottom: '16px' }}>
                  {hlsSupported ? '点击获取HLS流地址' : '当前浏览器不支持HLS播放'}
                </div>
                <Space direction="vertical" align="center">
                  <Button 
                    type="primary" 
                    icon={<PlayCircleOutlined />}
                    loading={isLoadingPreview}
                    onClick={async () => {
                      if (selectedRoom) {
                        await tryGetHlsStream(selectedRoom);
                      }
                    }}
                    disabled={!hlsSupported}
                  >
                    获取流地址
                  </Button>
                  <Text style={{ color: '#ccc', fontSize: '12px' }}>
                    HLS.js支持: {hlsSupported ? '✅ 已启用' : '❌ 需要更新浏览器'}
                  </Text>
                  {!hlsSupported && (
                    <Text style={{ color: '#ccc', fontSize: '11px', maxWidth: '300px' }}>
                      建议使用 Chrome、Firefox、Edge 等现代浏览器
                    </Text>
                  )}
                </Space>
              </div>
            )}
          </div>
        );

      case 'flv':
        return (
          <div style={{
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            overflow: 'hidden',
            position: 'relative',
            minHeight: '400px',
            backgroundColor: '#000'
          }}>
            {flvError ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '400px',
                color: 'white',
                textAlign: 'center',
                padding: '20px'
              }}>
                <Alert
                  message="FLV播放错误"
                  description={flvError}
                  type="error"
                  showIcon
                  style={{ marginBottom: '16px', backgroundColor: 'rgba(255,255,255,0.9)' }}
                />
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={async () => {
                    if (selectedRoom) {
                      await tryGetFlvStream(selectedRoom);
                    }
                  }}
                  loading={isLoadingPreview}
                >
                  重试加载
                </Button>
              </div>
            ) : flvUrl ? (
              <div style={{ position: 'relative' }}>
                <video
                  ref={(videoEl) => {
                    if (videoEl && selectedRoom && flvUrl && !flvRef.current) {
                      // 模仿多画面监控的成功模式
                      setTimeout(() => {
                        createFlvPlayer(selectedRoom, videoEl, flvUrl);
                      }, 150);
                    }
                  }}
                  controls
                  autoPlay
                  muted
                  style={{ width: '100%', height: '400px', backgroundColor: '#000' }}
                  poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZMVjwvZm9udD48L3RleHQ+PC9zdmc+"
                >
                  您的浏览器不支持视频播放
                </video>
                 <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  🎬 FLV 流播放
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '400px',
                color: 'white',
                textAlign: 'center'
              }}>
                <video ref={videoRef} style={{ display: 'none' }} />
                <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div style={{ marginBottom: '16px' }}>点击获取FLV流地址</div>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={isLoadingPreview}
                  onClick={async () => {
                    if (selectedRoom) {
                      // 这里只触发状态变化，让ref回调处理播放器创建
                      const streamUrl = await getFlvStreamForRoom(selectedRoom);
                      if (streamUrl) {
                        setFlvUrl(streamUrl);
                      } else {
                        setFlvError('获取FLV流失败');
                      }
                    }
                  }}
                >
                  获取流地址
                </Button>
              </div>
            )}
          </div>
        );

      case 'webrtc':
        return (
          <div style={{ 
            border: '1px solid #d9d9d9', 
            borderRadius: '6px', 
            overflow: 'hidden',
            position: 'relative',
            minHeight: '400px',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ExperimentOutlined style={{ fontSize: '48px', color: '#722ed1', marginBottom: '16px' }} />
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Title level={4}>WebRTC 实时流</Title>
              <Text type="secondary">需要配置信令服务器和流媒体服务器</Text>
            </div>
            <Space direction="vertical" align="center">
              <Button 
                type="primary" 
                icon={<PlayCircleOutlined />}
                loading={isLoadingPreview}
                onClick={() => tryWebRtcConnection(selectedRoom)}
              >
                尝试连接
              </Button>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                WebRTC需要后端支持，当前为演示模式
              </Text>
            </Space>
          </div>
        );

      case 'pip':
        return (
          <div style={{ 
            border: '1px solid #d9d9d9', 
            borderRadius: '6px', 
            overflow: 'hidden',
            position: 'relative',
            minHeight: '400px',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Title level={4}>画中画模式</Title>
              <Text type="secondary">点击视频即可启动画中画模式</Text>
            </div>
            <Space direction="vertical" align="center">
              <Button 
                type="primary" 
                icon={<PlayCircleOutlined />}
                loading={isLoadingPreview}
                onClick={tryPictureInPicture}
              >
                启动画中画
              </Button>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                当前浏览器支持画中画功能
              </Text>
            </Space>
          </div>
        );

      default:
        // 原有的信息卡片显示
        return (
          <div style={{ 
            border: '1px solid #d9d9d9', 
            borderRadius: '6px', 
            overflow: 'hidden',
            position: 'relative',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fafafa'
          }}>
            {/* 原有的信息卡片代码 */}
            <Card 
              style={{ 
                width: '80%', 
                maxWidth: '500px', 
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              cover={
                <div style={{ 
                  height: '200px', 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '12px' }} />
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>{selectedRoom.title}</div>
                    <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>
                      {selectedRoom.streamer}
                    </div>
                  </div>
                </div>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Badge 
                    status={selectedRoom.status === 'live' ? 'success' : selectedRoom.status === 'offline' ? 'error' : 'default'} 
                    text={
                      <span style={{ fontSize: '16px', fontWeight: '500' }}>
                        {selectedRoom.status === 'live' ? '🔴 直播中' : 
                         selectedRoom.status === 'offline' ? '⚪ 未直播' : '❓ 状态未知'}
                      </span>
                    }
                  />
                </div>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600', color: '#1890ff' }}>
                        {selectedRoom.totalRecordings}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>录制次数</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '600', color: selectedRoom.isRecording ? '#fa541c' : '#999' }}>
                        {selectedRoom.isRecording ? '🔴' : '⚪'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>录制状态</div>
                    </div>
                  </Col>
                </Row>
                
                <Divider style={{ margin: '8px 0' }} />
                
                <Space>
                  <Button 
                    type="primary" 
                    icon={<PlayCircleOutlined />}
                    onClick={() => window.open(selectedRoom.url, '_blank')}
                  >
                    新窗口观看
                  </Button>
                </Space>
              </Space>
            </Card>
            
            {selectedRoom.isRecording && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(255, 0, 0, 0.8)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                🔴 录制中...
              </div>
            )}
          </div>
        );
    }
  };

  // 渲染多画面内容
  const renderMultiViewContent = () => {
    const selectedRoomsList = getSelectedRoomsList();
    
    if (selectedRoomsList.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px', 
          color: '#999',
          border: '2px dashed #d9d9d9',
          borderRadius: '6px'
        }}>
          <EyeOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
          <br />
          请选择要监控的直播间（按住Ctrl多选）
        </div>
      );
    }

    // 计算网格布局
    const getGridLayout = () => {
      switch (multiViewMode) {
        case 'grid2x2': return { cols: 2, rows: 2 };
        case 'grid3x3': return { cols: 3, rows: 3 };
        case 'grid4x4': return { cols: 4, rows: 4 };
        default: return { cols: 1, rows: 1 };
      }
    };

    const { cols, rows } = getGridLayout();
    const cellWidth = `${100 / cols}%`;
    const cellHeight = `${100 / rows}%`;

    return (
      <div style={{
        width: '100%',
        height: '600px',
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: '4px',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: '#f5f5f5'
      }}>
        {Array.from({ length: cols * rows }).map((_, index) => {
          const room = selectedRoomsList[index];
          
          if (!room) {
            return (
              <div
                key={`empty-${index}`}
                style={{
                  backgroundColor: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ccc',
                  fontSize: '14px',
                  border: '1px dashed #e0e0e0'
                }}
              >
                空闲画面
              </div>
            );
          }

          return (
            <div
              key={room.id}
              style={{
                position: 'relative',
                backgroundColor: '#000',
                border: '1px solid #333',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              {/* 房间信息叠加层 */}
              {multiViewSettings.showRoomInfo && (
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  right: '4px',
                  zIndex: 10,
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                      {room.title}
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.8 }}>
                      {room.streamer}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Badge 
                      status={room.status === 'live' ? 'success' : room.status === 'offline' ? 'error' : 'default'} 
                      text=""
                    />
                    {room.isRecording && (
                      <div style={{
                        background: 'rgba(255, 0, 0, 0.8)',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        fontSize: '8px'
                      }}>
                        REC
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div style={{
                position: 'absolute',
                bottom: '4px',
                right: '4px',
                zIndex: 10,
                display: 'flex',
                gap: '4px'
              }}>
                <Button
                  size="small"
                  type="text"
                  style={{ 
                    backgroundColor: 'rgba(0,0,0,0.7)', 
                    color: 'white', 
                    fontSize: '10px',
                    height: '22px',
                    padding: '0 6px',
                    borderRadius: '4px',
                    border: 'none'
                  }}
                  onClick={() => setSelectedRoom(room)}
                >
                  详情
                </Button>
                <Button
                  size="small"
                  type="text"
                  loading={room.isRecordingLoading}
                  style={{
                    backgroundColor: room.isRecording 
                      ? 'rgba(255, 77, 79, 0.9)' 
                      : 'rgba(82, 196, 26, 0.9)',
                    color: 'white',
                    fontSize: '10px',
                    height: '22px',
                    padding: '0 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontWeight: '600'
                  }}
                  onClick={() => room.isRecording ? stopRecording(room.id) : openRecordingModeModal(room)}
                >
                  {room.isRecording ? '停止' : '录制'}
                </Button>
              </div>

              {/* 预览内容 */}
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                {renderRoomPreview(room, index)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 渲染单个房间的预览内容
  const renderRoomPreview = (room: LiveRoom, index: number) => {
    const previewMode = multiViewSettings.syncPreviewMode ? previewSettings.mode : 'info';
    
    switch (previewMode) {
      case 'screenshot':
        return (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#333'
          }}>
            <Button
              type="text"
              style={{ color: 'white' }}
              onClick={() => captureScreenshot(room)}
            >
              📸 点击截图
            </Button>
          </div>
        );

      case 'hls':
        return (
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            position: 'relative'
          }}>
            <video
              key={`hls-${room.id}-${index}`}
              controls
              muted
              autoPlay
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000'
              }}
              onLoadStart={() => {
                console.log(`🎬 开始加载HLS流 - 房间: ${room.title}`);
                // 这里可以添加获取HLS流的逻辑
              }}
            >
              <source src="" type="application/x-mpegURL" />
              您的浏览器不支持视频播放
            </video>
            <div style={{
              position: 'absolute',
              bottom: '4px',
              left: '4px',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '2px',
              fontSize: '10px'
            }}>
              HLS
            </div>
          </div>
        );

      case 'flv':
        return (
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            position: 'relative'
          }}>
            <video
              key={`flv-${room.id}-${index}`}
              ref={(videoEl) => {
                if (videoEl && !multiViewFlvPlayers.has(room.id)) {
                  // 延迟创建播放器，确保DOM已渲染
                  setTimeout(() => {
                    createFlvPlayerForRoom(room, videoEl);
                  }, 500);
                }
              }}
              controls
              muted
              autoPlay
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000'
              }}
            >
              您的浏览器不支持视频播放
            </video>
            <div style={{
              position: 'absolute',
              bottom: '4px',
              left: '4px',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '2px',
              fontSize: '10px'
            }}>
              {multiViewStreamUrls.has(room.id) ? 'FLV ✓' : 'FLV'}
            </div>
            <div style={{
              position: 'absolute',
              bottom: '4px',
              right: '28px'
            }}>
              <Button
                size="small"
                type="text"
                style={{ 
                  color: 'white', 
                  fontSize: '10px',
                  height: '18px',
                  padding: '0 4px',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: '3px',
                  border: 'none'
                }}
                onClick={async () => {
                  console.log(`🔗 手动获取房间 ${room.title} 的FLV流`);
                  const videoEl = document.querySelector(`video[key="flv-${room.id}-${index}"]`) as HTMLVideoElement;
                  if (videoEl) {
                    await createFlvPlayerForRoom(room, videoEl);
                  }
                }}
              >
                获取流
              </Button>
            </div>
          </div>
        );

      case 'info':
      default:
        return (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            textAlign: 'center',
            padding: '8px'
          }}>
            <PlayCircleOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              {room.title}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>
              {room.streamer}
            </div>
            <div style={{ marginTop: '8px', fontSize: '10px' }}>
              录制次数: {room.totalRecordings}
            </div>
          </div>
        );
    }
  };

  // 监听选择状态变化，用于调试验证
  useEffect(() => {
    console.log('📊 选择状态变化 - 当前选择:', selectedRooms.size, '总房间数:', rooms.length);
    console.log('📊 选择的房间IDs:', Array.from(selectedRooms));
  }, [selectedRooms, rooms.length]);

  // 打开录制模式选择
  const openRecordingModeModal = (room: LiveRoom) => {
    setSelectedRoomForRecording(room);
    setIsRecordingModeModalOpen(true);
  };

  // 确认开始录制
  const confirmStartRecording = async (mode: 'screen' | 'stream') => {
    if (!selectedRoomForRecording) return;
    
    try {
      // 直接将模式传递给录制函数，避免状态更新延迟
      await startRecording(selectedRoomForRecording, mode);
      setIsRecordingModeModalOpen(false);
      setSelectedRoomForRecording(null);
    } catch (error) {
      // 错误已在 startRecording 中处理
      console.error('确认录制时发生错误:', error);
    }
  };

  // 创建单画面FLV播放器
  const createFlvPlayer = async (room: LiveRoom, videoElement: HTMLVideoElement, streamUrlToUse: string) => {
    if (!videoElement) {
      console.warn('[FLV] Video element is not available.');
      setFlvError('播放器元素未准备好');
      return;
    }

    cleanupFlv(); // 清理旧的实例

    if (!streamUrlToUse) {
      console.warn(`[FLV] 房间 ${room.id} 无法获取FLV流`);
      setFlvError('获取FLV流失败');
      return;
    }

    const streamUrl = streamUrlToUse;
    setFlvUrl(streamUrl);
    
    console.log('[FLV] 开始加载FLV流:', streamUrl);

    try {
      if (flvjs.isSupported()) {
        const player = flvjs.createPlayer({
          type: 'flv',
          url: streamUrl,
          isLive: true,
          hasAudio: true,
          hasVideo: true,
        });

        flvRef.current = player;
        player.attachMediaElement(videoElement);
        
        player.on(flvjs.Events.ERROR, (errorType, errorDetail) => {
          console.error('[FLV] 播放器错误:', { errorType, errorDetail });
          setFlvError(`播放错误: ${errorType} - ${errorDetail}`);
          cleanupFlv();
        });

        player.load();
        player.play();
        
        setFlvError('');
      } else {
        console.error('[FLV] 浏览器不支持FLV');
        setFlvError('您的浏览器不支持FLV播放');
      }
    } catch (error) {
      console.error('[FLV] 创建播放器时捕获到错误:', error);
      setFlvError('创建FLV播放器失败');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <Title level={2} style={{ margin: 0 }}>🎥 直播间实时监控系统</Title>
              <Space>
                <Button 
                  icon={<ReloadOutlined />}
                  onClick={() => debouncedLoadRooms('手动刷新')}
                  loading={loading}
                >
                  刷新数据
                </Button>
                <Button 
                  icon={<SettingOutlined />}
                  onClick={() => setIsSettingsModalOpen(true)}
                >
                  系统设置
                </Button>
                <Popconfirm
                  title="确定要清空所有监控直播间吗？"
                  onConfirm={clearAllRooms}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button 
                    icon={<ClearOutlined />}
                  >
                    清空所有
                  </Button>
                </Popconfirm>
              </Space>
            </div>
            
            <Alert
              message="直播间监控中心"
              description="从直播间管理页面导入的直播间将在此进行实时监控和录制"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />

            {/* 全局录制状态提示 */}
            {rooms.filter(r => r.isRecording).length > 0 && (
              <Alert
                message={`🔴 正在录制 ${rooms.filter(r => r.isRecording).length} 个直播间`}
                description={
                  <div>
                    <span>录制中的直播间: </span>
                    {rooms.filter(r => r.isRecording).map((room, index) => (
                      <span key={room.id}>
                        <strong>{room.title}</strong>
                        {index < rooms.filter(r => r.isRecording).length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginBottom: '16px' }}
                action={
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      rooms.filter(r => r.isRecording).forEach(room => {
                        stopRecording(room.id);
                      });
                    }}
                  >
                    停止全部录制
                  </Button>
                }
              />
            )}

            {/* 系统统计 */}
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: '6px', border: '1px solid #f0f0f0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#1890ff', marginBottom: '4px' }}>
                      {rooms.length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>总直播间</div>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: '6px', border: '1px solid #f0f0f0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#52c41a', marginBottom: '4px' }}>
                      {rooms.filter(r => r.status === 'live').length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>直播中</div>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: '6px', border: '1px solid #f0f0f0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#fa541c', marginBottom: '4px' }}>
                      {rooms.filter(r => r.isRecording).length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>录制中</div>
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ borderRadius: '6px', border: '1px solid #f0f0f0' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#722ed1', marginBottom: '4px' }}>
                      {rooms.reduce((total, room) => total + room.totalRecordings, 0)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>总录制数</div>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 直播间列表 */}
        <Col span={8}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📋 直播间列表</span>
                <Space>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {selectedRooms.size > 0 ? `已选择 ${selectedRooms.size} 个` : '单击选择'}
                  </Text>
                  <Button 
                    size="small" 
                    type={selectedRooms.size === rooms.length && rooms.length > 0 ? "primary" : "default"}
                    onClick={toggleSelectAll}
                    disabled={rooms.length === 0}
                  >
                    {selectedRooms.size === rooms.length && rooms.length > 0 ? '取消全选' : '全选'}
                  </Button>
                  <Button 
                    size="small" 
                    onClick={clearSelection}
                    disabled={selectedRooms.size === 0}
                  >
                    清空
                  </Button>
                </Space>
              </div>
            } 
            size="small" 
            loading={loading}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {rooms.map(room => (
                <Card
                  key={room.id}
                  size="small"
                  hoverable
                  style={{
                    border: selectedRooms.has(room.id) 
                      ? '2px solid #1890ff' 
                      : selectedRoom?.id === room.id 
                        ? '2px solid #52c41a' 
                        : '1px solid #d9d9d9',
                    position: 'relative',
                    backgroundColor: selectedRooms.has(room.id) ? '#f6ffed' : undefined
                  }}
                  onClick={(e) => {
                    // 检查是否按住了Ctrl键进行多选
                    if (e.ctrlKey || e.metaKey) {
                      toggleRoomSelection(room.id, true);
                    } else {
                      // 单选模式
                      toggleRoomSelection(room.id, false);
                    }
                  }}
                  actions={[
                    <Button 
                      key="record"
                      type={room.isRecording ? "default" : "primary"}
                      danger={room.isRecording}
                      size="small"
                      loading={room.isRecordingLoading} // 绑定加载状态
                      onClick={(e) => {
                        e.stopPropagation();
                        if (room.isRecording) {
                          stopRecording(room.id);
                        } else {
                          openRecordingModeModal(room);
                        }
                      }}
                      style={{
                        backgroundColor: room.isRecording ? '#ff4d4f' : '#52c41a',
                        borderColor: room.isRecording ? '#ff4d4f' : '#52c41a',
                        color: 'white',
                        fontWeight: '600',
                        width: '90px',
                        height: '32px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        boxShadow: room.isRecording 
                          ? '0 2px 8px rgba(255, 77, 79, 0.3)' 
                          : '0 2px 8px rgba(82, 196, 26, 0.3)',
                        transition: 'all 0.3s ease',
                        border: 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!room.isRecording) {
                          e.currentTarget.style.backgroundColor = '#73d13d';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(82, 196, 26, 0.4)';
                        } else {
                          e.currentTarget.style.backgroundColor = '#ff7875';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 77, 79, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!room.isRecording) {
                          e.currentTarget.style.backgroundColor = '#52c41a';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(82, 196, 26, 0.3)';
                        } else {
                          e.currentTarget.style.backgroundColor = '#ff4d4f';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 77, 79, 0.3)';
                        }
                      }}
                    >
                      {room.isRecording ? '停止录制' : '开始录制'}
                    </Button>,
                    <Popconfirm
                      key="delete"
                      title="确定要移除这个监控直播间吗？"
                      onConfirm={(e) => {
                        if (e) e.stopPropagation();
                        deleteRoom(room.id);
                      }}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button 
                        danger 
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        移除
                      </Button>
                    </Popconfirm>
                  ]}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>{room.title}</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Badge 
                          status={room.status === 'live' ? 'success' : room.status === 'offline' ? 'error' : 'default'} 
                          text={room.status === 'live' ? '直播中' : room.status === 'offline' ? '未直播' : '未知'}
                        />
                        {room.isRecording && (
                          <div style={{
                            background: 'rgba(255, 0, 0, 0.8)',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '500'
                          }}>
                            🔴 REC
                          </div>
                        )}
                      </div>
                    </div>
                    <Text type="secondary">主播: {room.streamer}</Text>
                    <br />
                    <Text type="secondary">分类: {room.category}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      最后检测: {room.lastCheck}
                    </Text>
                    {room.isRecording && (
                      <div style={{ marginTop: '8px' }}>
                        <Badge status="processing" text="正在录制中..." />
                      </div>
                    )}
                    {room.totalRecordings > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          录制次数: {room.totalRecordings}
                        </Text>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              
              {rooms.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  暂无直播间
                  <br />
                  请从直播间管理页面导入直播间
                </div>
              )}
            </Space>
          </Card>
        </Col>

        {/* 直播间预览 */}
        <Col span={16}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span>
                    {multiViewMode !== 'single' && selectedRooms.size > 1 
                      ? `📺 多画面监控 (${selectedRooms.size}个直播间)` 
                      : '📺 直播间预览'
                    }
                  </span>
                </div>
                
                {/* 多画面布局控制 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    布局模式:
                  </Text>
                  <Radio.Group 
                    value={multiViewMode} 
                    onChange={(e) => switchMultiViewMode(e.target.value)}
                    size="small"
                  >
                    <Radio.Button value="single">
                      {selectedRooms.size <= 1 ? '单画面' : '切换单画面'}
                    </Radio.Button>
                    <Radio.Button 
                      value="grid2x2"
                      disabled={selectedRooms.size < 2}
                    >
                      2×2
                    </Radio.Button>
                    <Radio.Button 
                      value="grid3x3"
                      disabled={selectedRooms.size < 3}
                    >
                      3×3
                    </Radio.Button>
                    <Radio.Button 
                      value="grid4x4"
                      disabled={selectedRooms.size < 4}
                    >
                      4×4
                    </Radio.Button>
                  </Radio.Group>
                  
                  {/* 移除全选控制
                  {selectedRooms.size > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        选择:
                      </Text>
                      <Button 
                        size="small"
                        onClick={toggleSelectAll}
                        disabled={rooms.length === 0}
                      >
                        {selectedRooms.size === rooms.length && rooms.length > 0 ? '取消全选' : '全选'}
                      </Button>
                      <Button 
                        size="small"
                        onClick={clearSelection}
                        disabled={selectedRooms.size === 0}
                      >
                        清空
                      </Button>
                    </div>
                  )}
                  */}
                </div>
              </div>
            }
            size="small"
            extra={
                <Space>
                {multiViewMode !== 'single' && selectedRooms.size > 1 ? (
                  // 多画面模式的控制
                  <>
                    <Text type="secondary" style={{ fontSize: '12px' }}>多画面设置:</Text>
                    <Switch
                      checked={multiViewSettings.syncPreviewMode}
                      onChange={(checked) => setMultiViewSettings(prev => ({ ...prev, syncPreviewMode: checked }))}
                      checkedChildren="同步预览"
                      unCheckedChildren="独立预览"
                      size="small"
                    />
                    <Switch
                      checked={multiViewSettings.autoRotate}
                      onChange={(checked) => setMultiViewSettings(prev => ({ ...prev, autoRotate: checked }))}
                      checkedChildren="轮播"
                      unCheckedChildren="固定"
                      size="small"
                    />
                    <Switch
                      checked={multiViewSettings.showRoomInfo}
                      onChange={(checked) => setMultiViewSettings(prev => ({ ...prev, showRoomInfo: checked }))}
                      checkedChildren="显示信息"
                      unCheckedChildren="隐藏信息"
                      size="small"
                    />
                  </>
                ) : (
                  // 单画面模式的控制
                  selectedRoom && (
                    <>
                  <Text type="secondary" style={{ fontSize: '12px' }}>预览模式:</Text>
                  <Radio.Group 
                    value={previewSettings.mode} 
                    onChange={(e) => handlePreviewModeChange(e.target.value)}
                    size="small"
                  >
                    <Radio.Button value="info">信息</Radio.Button>
                    <Radio.Button value="screenshot">截图</Radio.Button>
                    <Radio.Button value="hls">HLS流</Radio.Button>
                    <Radio.Button value="flv">FLV流</Radio.Button>
                    <Radio.Button value="webrtc">WebRTC</Radio.Button>
                    <Radio.Button value="pip">画中画</Radio.Button>
                  </Radio.Group>
                    </>
                  )
                )}
                
                {/* 多画面模式下的预览模式选择 */}
                {multiViewMode !== 'single' && selectedRooms.size > 1 && multiViewSettings.syncPreviewMode && (
                  <>
                    <Divider type="vertical" />
                    <Text type="secondary" style={{ fontSize: '12px' }}>同步预览:</Text>
                    <Radio.Group 
                      value={previewSettings.mode} 
                      onChange={(e) => handlePreviewModeChange(e.target.value)}
                      size="small"
                    >
                      <Radio.Button value="info">信息</Radio.Button>
                      <Radio.Button value="screenshot">截图</Radio.Button>
                      <Radio.Button value="hls">HLS</Radio.Button>
                      <Radio.Button value="flv">FLV</Radio.Button>
                      <Radio.Button value="webrtc">WebRTC</Radio.Button>
                      <Radio.Button value="pip">画中画</Radio.Button>
                    </Radio.Group>
                  </>
                )}
              </Space>
            }
          >
            {selectedRoom && (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Title level={4} style={{ margin: 0 }}>{selectedRoom.title}</Title>
                      {selectedRoom.isRecording && (
                        <div style={{
                          background: 'rgba(255, 0, 0, 0.9)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          🔴 正在录制
                        </div>
                      )}
                    </div>
                    <Text type="secondary">主播: {selectedRoom.streamer} | 分类: {selectedRoom.category}</Text>
                  </div>
                  <Space>
                    <Button
                      type="default"
                      icon={<PlayCircleOutlined />}
                      onClick={() => window.open(selectedRoom.url, '_blank')}
                    >
                      新窗口观看
                    </Button>
                    {previewSettings.mode === 'screenshot' && (
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => captureScreenshot(selectedRoom)}
                        loading={isLoadingPreview}
                      >
                        刷新截图
                      </Button>
                    )}
                  </Space>
                </div>
                
                {renderPreviewContent()}
                
                {/* 预览设置 */}
                {previewSettings.mode === 'screenshot' && (
                  <div style={{ marginTop: '16px' }}>
                    <Card size="small" title="📸 截图设置">
                      <Space>
                        <Switch
                          checked={previewSettings.autoRefresh}
                          onChange={(checked) => setPreviewSettings(prev => ({ ...prev, autoRefresh: checked }))}
                          checkedChildren="自动刷新"
                          unCheckedChildren="手动刷新"
                        />
                        {previewSettings.autoRefresh && (
                          <Select
                            value={previewSettings.refreshInterval}
                            onChange={(value) => setPreviewSettings(prev => ({ ...prev, refreshInterval: value }))}
                            style={{ width: 120 }}
                          >
                            <Option value={10}>10秒</Option>
                            <Option value={30}>30秒</Option>
                            <Option value={60}>60秒</Option>
                            <Option value={120}>2分钟</Option>
                          </Select>
                        )}
                      </Space>
                    </Card>
                  </div>
                )}
                
                <div style={{ marginTop: '16px' }}>
                  <Alert
                    message="📹 录制操作说明"
                    description={
                      <div>
                        <p style={{ margin: '4px 0' }}>
                          <strong>开始录制：</strong>点击左侧直播间卡片中的"开始录制"按钮
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>停止录制：</strong>再次点击同一按钮变为"停止录制"
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>录制设置：</strong>可在右上角"系统设置"中配置录制质量、模式等选项
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>录制状态：</strong>录制中的直播间会显示红色"🔴 REC"标识
                        </p>
                      </div>
                    }
                    type="success"
                    showIcon
                    style={{ fontSize: '12px' }}
                  />
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <Alert
                    message="🖥️ 多画面监控说明"
                    description={
                      <div>
                        <p style={{ margin: '4px 0' }}>
                          <strong>多选直播间：</strong>按住Ctrl键点击直播间卡片进行多选，支持快速全选
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>网格布局：</strong>支持2×2、3×3、4×4网格，最多可同时监控16个直播间
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>同步模式：</strong>开启同步预览模式，所有画面使用相同的预览方式
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>自动轮播：</strong>启用后可自动切换显示的直播间，适合大量监控
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>快速操作：</strong>在多画面中可直接进行录制控制和详情查看
                        </p>
                      </div>
                    }
                    type="warning"
                    showIcon
                    style={{ fontSize: '12px' }}
                  />
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <Alert
                    message="多种预览技术探索"
                    description={
                      <div>
                        <p style={{ margin: '4px 0' }}>
                          <strong>信息模式：</strong>显示直播间基本信息和统计数据
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>截图模式：</strong>通过服务端或Canvas生成直播间截图预览
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>HLS流模式：</strong>尝试获取和播放HLS直播流(需要后端支持)
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>FLV流模式：</strong>尝试获取和播放FLV直播流(需要后端支持)
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>WebRTC模式：</strong>实时流传输技术(需要信令服务器)
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>画中画模式：</strong>点击视频即可启动画中画模式
                        </p>
                        <p style={{ margin: '4px 0' }}>
                          <strong>技术说明：</strong>这些是绕过CSP限制的常用技术方案，实际部署需要相应的后端支持
                        </p>
                      </div>
                    }
                    type="info"
                    showIcon
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>
            )}
            
            {!selectedRoom && renderPreviewContent()}
          </Card>
        </Col>
      </Row>

      {/* 录制设置模态框 */}
      <Modal
        title="⚙️ 系统设置"
        open={isSettingsModalOpen}
        onOk={() => setIsSettingsModalOpen(false)}
        onCancel={() => setIsSettingsModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <div>
          <Title level={4}>📹 录制设置</Title>
          <Form layout="vertical">
            <Form.Item label="录制质量">
              <Select 
                value={recordingSettings.quality}
                onChange={(value) => setRecordingSettings(prev => ({ ...prev, quality: value }))}
              >
                <Option value="high">高质量 (1080p)</Option>
                <Option value="medium">中质量 (720p)</Option>
                <Option value="low">低质量 (480p)</Option>
              </Select>
            </Form.Item>

            <Form.Item label="录制模式">
              <Radio.Group 
                value={recordingSettings.recordingMode}
                onChange={(e) => setRecordingSettings(prev => ({ ...prev, recordingMode: e.target.value }))}
              >
                <Radio value="screen">屏幕录制模式 (需要屏幕共享权限)</Radio>
                <Radio value="stream">流录制模式 (直接录制直播流，推荐)</Radio>
              </Radio.Group>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                {recordingSettings.recordingMode === 'screen' 
                  ? '通过屏幕共享技术录制，需要用户授权，适合录制任何内容'
                  : '直接从直播流录制，无需用户授权，质量更好，支持后台录制'
                }
              </div>
            </Form.Item>
            
            <Form.Item label="录制内容">
              <Switch
                checked={recordingSettings.audioOnly}
                onChange={(checked) => setRecordingSettings(prev => ({ ...prev, audioOnly: checked }))}
                checkedChildren="仅音频"
                unCheckedChildren="音视频"
              />
            </Form.Item>
            
            <Form.Item label="自动录制新直播">
              <Switch
                checked={recordingSettings.autoRecord}
                onChange={(checked) => setRecordingSettings(prev => ({ ...prev, autoRecord: checked }))}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Form.Item>
            
            <Form.Item label={`最大录制时长: ${recordingSettings.maxDuration} 分钟`}>
              <Slider
                min={10}
                max={300}
                value={recordingSettings.maxDuration}
                onChange={(value) => setRecordingSettings(prev => ({ ...prev, maxDuration: value }))}
              />
            </Form.Item>
            
            <Form.Item label="主播下线时自动停止录制">
              <Switch
                checked={recordingSettings.autoStopOnOffline}
                onChange={(checked) => setRecordingSettings(prev => ({ ...prev, autoStopOnOffline: checked }))}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Form.Item>

            <Divider />

            <Form.Item label="录制文件管理">
              <Space>
                <Button 
                  icon={<FileAddOutlined />}
                  onClick={() => setIsStreamRecordingModalOpen(true)}
                >
                  查看录制文件
                </Button>
                <Button 
                  icon={<CloudDownloadOutlined />}
                  onClick={() => loadStreamRecordingFiles()}
                >
                  刷新文件列表
                </Button>
              </Space>
            </Form.Item>
          </Form>

          <Title level={4} style={{ marginTop: '24px' }}>🔍 自动检测设置</Title>
          <Form layout="vertical">
            <Form.Item label="启用自动检测">
              <Switch
                checked={autoDetectionSettings.enabled}
                onChange={(checked) => setAutoDetectionSettings(prev => ({ ...prev, enabled: checked }))}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Form.Item>
            
            <Form.Item label={`检测间隔: ${autoDetectionSettings.interval} 秒`}>
              <Slider
                min={60}
                max={1800}
                step={60}
                value={autoDetectionSettings.interval}
                onChange={(value) => setAutoDetectionSettings(prev => ({ ...prev, interval: value }))}
              />
            </Form.Item>
            
            <Form.Item label="仅检测选中的直播间">
              <Switch
                checked={autoDetectionSettings.checkOnlySelected}
                onChange={(checked) => setAutoDetectionSettings(prev => ({ ...prev, checkOnlySelected: checked }))}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Form.Item>
          </Form>

          <Title level={4} style={{ marginTop: '24px' }}>📺 多画面监控设置</Title>
          <Form layout="vertical">
            <Form.Item label="默认多画面模式">
              <Radio.Group 
                value={multiViewMode}
                onChange={(e) => switchMultiViewMode(e.target.value)}
              >
                <Radio value="single">单画面模式</Radio>
                <Radio value="grid2x2">2×2网格 (最多4个直播间)</Radio>
                <Radio value="grid3x3">3×3网格 (最多9个直播间)</Radio>
                <Radio value="grid4x4">4×4网格 (最多16个直播间)</Radio>
              </Radio.Group>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                选择多个直播间时自动切换到对应的网格模式
              </div>
            </Form.Item>
            
            <Form.Item label="同步预览模式">
              <Switch
                checked={multiViewSettings.syncPreviewMode}
                onChange={(checked) => setMultiViewSettings(prev => ({ ...prev, syncPreviewMode: checked }))}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                开启后，所有画面使用相同的预览模式（截图/HLS/FLV等）
              </div>
            </Form.Item>
            
            <Form.Item label="显示房间信息">
              <Switch
                checked={multiViewSettings.showRoomInfo}
                onChange={(checked) => setMultiViewSettings(prev => ({ ...prev, showRoomInfo: checked }))}
                checkedChildren="显示"
                unCheckedChildren="隐藏"
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                在每个画面上显示直播间标题、主播名称和状态信息
              </div>
            </Form.Item>
            
            <Form.Item label="自动轮播">
              <Switch
                checked={multiViewSettings.autoRotate}
                onChange={(checked) => setMultiViewSettings(prev => ({ ...prev, autoRotate: checked }))}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Form.Item>
            
            {multiViewSettings.autoRotate && (
              <Form.Item label={`轮播间隔: ${multiViewSettings.rotateInterval} 秒`}>
                <Slider
                  min={5}
                  max={60}
                  step={5}
                  value={multiViewSettings.rotateInterval}
                  onChange={(value) => setMultiViewSettings(prev => ({ ...prev, rotateInterval: value }))}
                />
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  自动切换显示的直播间，适合监控大量直播间
                </div>
              </Form.Item>
            )}
            
            <Form.Item label="多画面操作">
              <Space>
                <Button 
                  onClick={toggleSelectAll}
                  disabled={rooms.length === 0}
                >
                  {selectedRooms.size === rooms.length && rooms.length > 0 ? '取消全选' : '全选直播间'}
                </Button>
                <Button 
                  onClick={clearSelection}
                  disabled={selectedRooms.size === 0}
                >
                  清空选择
                </Button>
                <Button 
                  type="primary"
                  disabled={selectedRooms.size < 2}
                  onClick={() => switchMultiViewMode('grid2x2')}
                >
                  启动多画面
                </Button>
              </Space>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                当前已选择 {selectedRooms.size} 个直播间，
                {selectedRooms.size >= 2 ? '可以启动多画面监控' : '需要至少选择2个直播间'}
              </div>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* 流录制文件管理模态框 */}
      <Modal
        title="📁 流录制文件管理"
        open={isStreamRecordingModalOpen}
        onCancel={() => setIsStreamRecordingModalOpen(false)}
        footer={[
          <Button key="refresh" onClick={() => loadStreamRecordingFiles()}>
            刷新列表
          </Button>,
          <Button key="close" type="primary" onClick={() => setIsStreamRecordingModalOpen(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div>
          <Alert
            message="流录制文件说明"
            description="这里显示通过流录制模式生成的所有录制文件，支持下载和管理"
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
          
          {streamRecordingFiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              <FileAddOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <div>暂无录制文件</div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                使用流录制模式开始录制后，文件将显示在这里
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {streamRecordingFiles.map((file) => (
                <Card 
                  key={file.id} 
                  size="small" 
                  style={{ marginBottom: '8px' }}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px' }}>{file.filename}</span>
                      <Button 
                        type="primary" 
                        size="small"
                        icon={<CloudDownloadOutlined />}
                        onClick={() => downloadRecordingFile(file.filename)}
                      >
                        下载
                      </Button>
                    </div>
                  }
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <div style={{ fontSize: '12px' }}>
                        <div><strong>录制时间:</strong></div>
                        <div>{new Date(file.started_at).toLocaleString()}</div>
                        {file.ended_at && (
                          <div>至 {new Date(file.ended_at).toLocaleString()}</div>
                        )}
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: '12px' }}>
                        <div><strong>文件信息:</strong></div>
                        <div>大小: {formatFileSize(file.file_size)}</div>
                        <div>时长: {formatDuration(file.duration)}</div>
                        <div>质量: {file.quality}</div>
                      </div>
                    </Col>
                    <Col span={8}>
                      <div style={{ fontSize: '12px' }}>
                        <div><strong>录制设置:</strong></div>
                        <div>类型: {file.audio_only ? '仅音频' : '音视频'}</div>
                        <div>状态: {file.status === 'completed' ? '完成' : file.status}</div>
                      </div>
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 录制模式选择模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <VideoCameraOutlined style={{ color: '#52c41a' }} />
            <span>选择录制模式</span>
          </div>
        }
        open={isRecordingModeModalOpen}
        onCancel={() => {
          setIsRecordingModeModalOpen(false);
          setSelectedRoomForRecording(null);
        }}
        footer={null}
        width={600}
        centered
      >
        <div style={{ padding: '16px 0' }}>
          <Alert
            message="录制模式说明"
            description={`即将开始录制直播间: ${selectedRoomForRecording?.title || ''}`}
            type="info"
            showIcon
            style={{ marginBottom: '24px' }}
          />
          
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
            {/* 流录制模式 */}
            <Card
              hoverable
              style={{
                width: '250px',
                textAlign: 'center',
                border: '2px solid #d9d9d9',
                borderRadius: '12px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#52c41a';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(82, 196, 26, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d9d9d9';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => confirmStartRecording('stream')}
            >
              <div style={{ padding: '16px' }}>
                <div style={{ 
                  fontSize: '48px', 
                  marginBottom: '16px',
                  background: 'linear-gradient(135deg, #52c41a, #73d13d)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  📡
                </div>
                <Title level={4} style={{ marginBottom: '8px' }}>
                  流录制模式
                </Title>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  直接录制直播流，无需权限，质量高，支持后台录制
                </Text>
                <div style={{ marginTop: '16px' }}>
                  <div style={{ 
                    display: 'inline-block',
                    backgroundColor: '#f6ffed',
                    color: '#52c41a',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    推荐
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                  ✓ 无需用户授权<br/>
                  ✓ 支持后台录制<br/>
                  ✓ 录制质量最佳<br/>
                  ✓ 占用资源少
                </div>
                <Button
                  type="primary"
                  style={{
                    marginTop: '16px',
                    width: '100%',
                    backgroundColor: '#52c41a',
                    borderColor: '#52c41a',
                    fontWeight: '600'
                  }}
                >
                  选择流录制
                </Button>
              </div>
            </Card>

            {/* 屏幕录制模式 */}
            <Card
              hoverable
              style={{
                width: '250px',
                textAlign: 'center',
                border: '2px solid #d9d9d9',
                borderRadius: '12px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#1890ff';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(24, 144, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d9d9d9';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => confirmStartRecording('screen')}
            >
              <div style={{ padding: '16px' }}>
                <div style={{ 
                  fontSize: '48px', 
                  marginBottom: '16px',
                  background: 'linear-gradient(135deg, #1890ff, #40a9ff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  🖥️
                </div>
                <Title level={4} style={{ marginBottom: '8px' }}>
                  屏幕录制模式
                </Title>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  通过屏幕共享录制，可录制任何内容，需要用户授权
                </Text>
                <div style={{ marginTop: '16px' }}>
                  <div style={{ 
                    display: 'inline-block',
                    backgroundColor: '#e6f7ff',
                    color: '#1890ff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    备选方案
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                  ⚠️ 需要用户授权<br/>
                  ⚠️ 需要保持页面活跃<br/>
                  ✓ 可录制任何内容<br/>
                  ✓ 兼容性较好
                </div>
                <Button
                  style={{
                    marginTop: '16px',
                    width: '100%',
                    borderColor: '#1890ff',
                    color: '#1890ff',
                    fontWeight: '600'
                  }}
                >
                  选择屏幕录制
                </Button>
              </div>
            </Card>
          </div>
          
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Button 
              onClick={() => {
                setIsRecordingModeModalOpen(false);
                setSelectedRoomForRecording(null);
              }}
              style={{ width: '120px' }}
            >
              取消录制
            </Button>
          </div>
        </div>
      </Modal>
     </div>
   );
 };
 
 export default LiveStreamMonitor; 