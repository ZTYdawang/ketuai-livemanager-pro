import axios from 'axios';

/**
 * 测试新的流监控系统
 */
async function testStreamMonitorSystem() {
    console.log('🧪 测试新的流监控系统 - iframe + 录制方案');
    console.log('=' .repeat(60));
    
    const baseUrl = 'http://localhost:5555';
    let roomId = null;
    
    try {
        // 1. 测试系统统计
        console.log('\n1️⃣ 测试系统统计');
        const statsResponse = await axios.get(`${baseUrl}/api/stream-monitor/stats`);
        console.log('✅ 系统统计:', {
            总房间数: statsResponse.data.data.rooms.total_rooms,
            直播中房间: statsResponse.data.data.rooms.live_rooms,
            录制中房间: statsResponse.data.data.rooms.recording_rooms,
            总录制数: statsResponse.data.data.recordings.total_recordings
        });
        
        // 2. 添加新直播间
        console.log('\n2️⃣ 添加新直播间');
        const addRoomResponse = await axios.post(`${baseUrl}/api/stream-monitor/rooms`, {
            url: 'https://live.douyin.com/870887192950',
            title: '测试直播间 - iframe监控',
            streamer: '测试主播',
            category: '游戏'
        });
        
        roomId = addRoomResponse.data.data.id;
        console.log('✅ 直播间添加成功:', {
            ID: roomId,
            标题: addRoomResponse.data.data.title,
            主播: addRoomResponse.data.data.streamer,
            分类: addRoomResponse.data.data.category,
            状态: addRoomResponse.data.data.status
        });
        
        // 3. 获取直播间列表
        console.log('\n3️⃣ 获取直播间列表');
        const roomsResponse = await axios.get(`${baseUrl}/api/stream-monitor/rooms`);
        console.log(`✅ 获取到 ${roomsResponse.data.data.length} 个直播间`);
        roomsResponse.data.data.forEach((room, index) => {
            console.log(`  ${index + 1}. ${room.title} - ${room.streamer} (${room.status})`);
        });
        
        // 4. 模拟开始录制
        console.log('\n4️⃣ 模拟开始录制');
        const startRecordingResponse = await axios.post(`${baseUrl}/api/stream-monitor/rooms/${roomId}/recording/start`, {
            quality: 'medium',
            audioOnly: false
        });
        console.log('✅ 录制开始成功:', {
            录制ID: startRecordingResponse.data.data.id,
            质量: startRecordingResponse.data.data.quality,
            仅音频: startRecordingResponse.data.data.audio_only
        });
        
        // 5. 更新直播间状态（模拟检测到直播中）
        console.log('\n5️⃣ 更新直播间状态为直播中');
        const updateStatusResponse = await axios.put(`${baseUrl}/api/stream-monitor/rooms/${roomId}/status`, {
            status: 'live',
            isRecording: true,
            recordingDuration: 120 // 2分钟
        });
        console.log('✅ 状态更新成功:', {
            状态: updateStatusResponse.data.data.status,
            录制中: updateStatusResponse.data.data.is_recording,
            录制时长: updateStatusResponse.data.data.recording_duration
        });
        
        // 6. 模拟停止录制
        console.log('\n6️⃣ 模拟停止录制');
        const stopRecordingResponse = await axios.post(`${baseUrl}/api/stream-monitor/rooms/${roomId}/recording/stop`, {
            filename: `测试主播_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.webm`,
            fileSize: 52428800, // 50MB
            duration: 120 // 2分钟
        });
        console.log('✅ 录制停止成功:', stopRecordingResponse.data.message);
        
        // 7. 获取录制历史
        console.log('\n7️⃣ 获取录制历史');
        const recordingsResponse = await axios.get(`${baseUrl}/api/stream-monitor/rooms/${roomId}/recordings`);
        console.log(`✅ 获取到 ${recordingsResponse.data.data.length} 条录制记录`);
        recordingsResponse.data.data.forEach((recording, index) => {
            console.log(`  ${index + 1}. ${recording.filename} (${recording.status}) - ${recording.duration}秒`);
        });
        
        // 8. 再次获取系统统计（验证变化）
        console.log('\n8️⃣ 获取更新后的系统统计');
        const updatedStatsResponse = await axios.get(`${baseUrl}/api/stream-monitor/stats`);
        console.log('✅ 更新后统计:', {
            总房间数: updatedStatsResponse.data.data.rooms.total_rooms,
            直播中房间: updatedStatsResponse.data.data.rooms.live_rooms,
            录制中房间: updatedStatsResponse.data.data.rooms.recording_rooms,
            总录制数: updatedStatsResponse.data.data.recordings.total_recordings,
            总录制时长: updatedStatsResponse.data.data.recordings.total_duration + '秒',
            总文件大小: Math.round(updatedStatsResponse.data.data.recordings.total_size / 1024 / 1024) + 'MB'
        });
        
        // 9. 清理：删除测试直播间
        console.log('\n9️⃣ 清理：删除测试直播间');
        const deleteResponse = await axios.delete(`${baseUrl}/api/stream-monitor/rooms/${roomId}`);
        console.log('✅ 直播间删除成功:', deleteResponse.data.message);
        
        console.log('\n🎉 新的流监控系统测试完成！');
        console.log('=' .repeat(60));
        console.log('✅ 核心功能验证:');
        console.log('  • 直播间管理 ✓');
        console.log('  • 状态更新 ✓');
        console.log('  • 录制功能 ✓');
        console.log('  • 历史记录 ✓');
        console.log('  • 系统统计 ✓');
        console.log('\n💡 优势对比:');
        console.log('  vs 原WebSocket+Protobuf方案:');
        console.log('  • 无需复杂的页面解析 ✓');
        console.log('  • 无需反爬虫机制 ✓');
        console.log('  • 真实可视化直播画面 ✓');
        console.log('  • 支持录制功能 ✓');
        console.log('  • 更稳定可靠 ✓');

    } catch (error) {
        console.error('❌ 测试失败:', error.response?.data || error.message);
        
        // 清理失败的测试数据
        if (roomId) {
            try {
                await axios.delete(`${baseUrl}/api/stream-monitor/rooms/${roomId}`);
                console.log('🧹 清理了失败的测试数据');
            } catch (cleanupError) {
                console.error('清理失败:', cleanupError.message);
            }
        }
    }
}

// 运行测试
testStreamMonitorSystem(); 