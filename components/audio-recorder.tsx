"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onRecordingComplete, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Audio recording not supported', {
          description: 'Please use a modern browser like Chrome, Firefox, or Safari.'
        });
        onCancel();
        return;
      }

      // Check if the page is served over HTTPS (required for getUserMedia in production)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        toast.error('Secure connection required', {
          description: 'Audio recording requires HTTPS. Please ensure the site is accessed via HTTPS.'
        });
        onCancel();
        return;
      }

      toast.info('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Recording started!');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error('Error accessing microphone:', error);

      // Provide specific error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error('Microphone access denied', {
          description: 'Please allow microphone permissions in your browser settings and try again.'
        });
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast.error('No microphone found', {
          description: 'Please connect a microphone and try again.'
        });
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        toast.error('Microphone in use', {
          description: 'Microphone is already in use by another application. Please close other apps using the microphone.'
        });
      } else {
        toast.error('Failed to access microphone', {
          description: error.message || 'Unknown error occurred'
        });
      }

      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleSend = () => {
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      onRecordingComplete(audioBlob);
    }
  };

  const handleDelete = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-gray-800 border-2 border-amber-500/50 rounded-3xl px-4 py-3">
      <div className="flex items-center gap-3 flex-1">
        {isRecording ? (
          <>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-gray-300 text-sm font-medium">Recording...</span>
            </div>
            <span className="text-amber-400 text-lg font-mono">{formatTime(recordingTime)}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={stopRecording}
              className="h-10 w-10 rounded-xl hover:bg-gray-700"
            >
              <Square className="h-5 w-5 text-red-500 fill-red-500" />
            </Button>
          </>
        ) : audioUrl ? (
          <>
            <audio src={audioUrl} controls className="flex-1 h-10" />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="h-10 w-10 rounded-xl hover:bg-red-500/10"
            >
              <Trash2 className="h-5 w-5 text-red-500" />
            </Button>
            <Button
              onClick={handleSend}
              className="bg-gradient-to-br from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 h-10 w-10 rounded-xl"
            >
              <Send className="h-5 w-5" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default AudioRecorder;
