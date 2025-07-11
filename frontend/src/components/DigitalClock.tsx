import React, { useState, useEffect } from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

const DigitalClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
    };
    return date.toLocaleDateString('zh-CN', options).replace(/\//g, '-');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '10px 0'
    }}>
      <Title level={1} style={{ margin: 0, fontWeight: 400, letterSpacing: '1px' }}>
        {formatTime(time)}
      </Title>
      <Text type="secondary" style={{ marginTop: '2px' }}>{formatDate(time)}</Text>
    </div>
  );
};

export default DigitalClock; 