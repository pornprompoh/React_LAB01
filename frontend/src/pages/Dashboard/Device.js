import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Page from '../../containers/Page/Page'
import {
  Box, Button, TextField, Typography, Grid, MenuItem, CircularProgress,
  FormControlLabel, Checkbox, IconButton, Accordion, AccordionSummary, AccordionDetails, Divider
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import CloseIcon from '@mui/icons-material/Close'

import TextFieldsIcon from '@mui/icons-material/TextFields'
import InsertChartIcon from '@mui/icons-material/InsertChart'
import SpeedIcon from '@mui/icons-material/Speed'
import MapIcon from '@mui/icons-material/Map'
import DateRangeIcon from '@mui/icons-material/DateRange' 

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const CHART_COLORS = ['#1976d2', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#00bcd4', '#795548', '#607d8b'];

const jsexe = async (code) => {
  try {
    const func = new Function(`return (${code})`)
    const result = func()
    if (result instanceof Promise) return await result
    return result
  } catch (error) { throw error }
}

const getIntervalMs = (intervalStr) => {
  switch(intervalStr) {
    case '1sec': return 1000;
    case '15sec': return 15000;
    case '30sec': return 30000;
    case '1min': return 60000;
    case 'daily': return 86400000;
    case 'week': return 604800000;
    case 'month': return 2592000000;
    case 'year': return 31536000000;
    default: return 1000;
  }
}

const DevicePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const isCreateMode = id === 'create'
  const collectionName = 'Device'
  const historyCollectionName = 'HistoryData' // ตารางใหม่สำหรับเก็บประวัติ

  const [loading, setLoading] = useState(!isCreateMode)
  const [saving, setSaving] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState(false) 
  
  const [activeTab, setActiveTab] = useState('devices') 
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  
  const today = new Date().toISOString().split('T')[0]; 
  const [selectedDate, setSelectedDate] = useState(today); 
  const [realtimeChartData, setRealtimeChartData] = useState([]);

  // State สำหรับเก็บข้อมูลอดีตที่ดึงมาจาก Database จริง
  const [historicalChartData, setHistoricalChartData] = useState([]);
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);

  const [device, setDevice] = useState({
    _id: '', code: '0', connection: 'Virtual', model: 'Virtual', ipAddr: '',
    name: 'Virtual', remark: 'Virtual Device', apiCode: '',
    lineChannel: '', lineId: '', emailFrom: '', emailPwd: '', emailTo: '',
    status: 'Active', revision: 1, tags: [],
    showChart: false, chartX: 200, chartY: 200,
    showDatetime: false, datetimeX: 500, datetimeY: 50 
  })

  const [originalDevice, setOriginalDevice] = useState(null)
  const [tagResults, setTagResults] = useState({})
  const [tagErrors, setTagErrors] = useState({})

  const tagsRef = useRef([])
  const tagResultsRef = useRef({}) 
  const tagErrorsRef = useRef({})
  const lastRunTimes = useRef({}) 
  const lastDbSaveTime = useRef(Date.now()) // ตัวนับเวลาสำหรับเซฟลง Database

  function getAuth() {
    let auth = null
    const item = localStorage.getItem('base-shell:auth')
    if (item) auth = JSON.parse(item)
    return auth
  }

  useEffect(() => { tagsRef.current = device.tags }, [device.tags])

  // --- [อัปเดตใหม่!] ดึงข้อมูลประวัติจาก Database ของจริง ---
  useEffect(() => {
    if (selectedDate === today) {
      setIsHistoricalMode(false);
    } else {
      setIsHistoricalMode(true);
      setIsChartLoading(true); 

      async function fetchHistoryFromDB() {
        try {
          const auth = getAuth();
          if (!auth) return;
          
          // ยิง API ไปค้นหาข้อมูลของอุปกรณ์ตัวนี้ ในวันที่เลือก
          const resp = await fetch('/api/preferences/readDocument', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
            body: JSON.stringify({ 
              collection: historyCollectionName, 
              query: { deviceId: id, date: selectedDate },
              // ถ้า backend ของคุณรองรับ sort ให้ใส่ไปด้วย หรือเรียงที่ frontend เอา
            })
          });

          const json = await resp.json();
          if (Array.isArray(json) && json.length > 0) {
            // เรียงลำดับข้อมูลตามเวลา (timestamp) ให้กราฟเส้นวิ่งจากซ้ายไปขวาถูกทิศ
            json.sort((a, b) => a.timestamp - b.timestamp);
            setHistoricalChartData(json);
          } else {
            // ถ้าค้นไม่เจอเลย
            setHistoricalChartData([]); 
          }
        } catch (error) {
          console.error("Error fetching history:", error);
          setHistoricalChartData([]);
        } finally {
          setIsChartLoading(false);
        }
      }

      fetchHistoryFromDB();
    }
  }, [selectedDate, today, id]);

  // --- [อัปเดตใหม่!] ระบบเซฟประวัติลง Database อัตโนมัติ (Data Logger) ---
  useEffect(() => {
    let isMounted = true;
    const intervalId = setInterval(async () => {
      const currentTags = tagsRef.current;
      if (!currentTags || currentTags.length === 0) return;

      const now = Date.now();
      let hasUpdates = false; 

      const newResults = { ...tagResultsRef.current };
      const newErrors = { ...tagErrorsRef.current };

      // 1. ประมวลผลสคริปต์
      await Promise.all(currentTags.map(async (tag, index) => {
        if (!tag.script || !tag.script.trim()) return;

        const intervalMs = getIntervalMs(tag.updateInterval);
        const lastRun = lastRunTimes.current[index] || 0;

        if (now - lastRun >= intervalMs) {
          try {
            const output = await jsexe(tag.script);
            newResults[index] = output;
            newErrors[index] = null;
          } catch (err) {
            newErrors[index] = err.message;
          }
          lastRunTimes.current[index] = now;
          hasUpdates = true;
        }
      }));

      // 2. อัปเดตหน้าจอ
      if (isMounted && hasUpdates) {
        setTagResults(newResults); tagResultsRef.current = newResults;
        setTagErrors(newErrors); tagErrorsRef.current = newErrors;

        const timeStr = new Date().toLocaleTimeString('th-TH', { hour12: false });
        const newChartPoint = { time: timeStr };

        currentTags.forEach((tag, index) => {
           const numValue = parseFloat(newResults[index]);
           if (!isNaN(numValue)) {
              newChartPoint[tag.label || `Tag ${index + 1}`] = numValue; 
           }
        });

        // โชว์กราฟ Live Data
        setRealtimeChartData(prev => {
           const newData = [...prev, newChartPoint];
           if (newData.length > 30) newData.shift(); 
           return newData;
        });
      }

      // 3. [สำคัญ!] ส่งข้อมูลไปเซฟลง Database ประวัติ ทุกๆ 1 นาที (60000 ms)
      if (now - lastDbSaveTime.current >= 60000) {
        const currentDateStr = new Date().toISOString().split('T')[0]; // เช่น "2026-02-24"
        const currentTimeStr = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute:'2-digit' }); // เช่น "14:30"
        
        let dataToSave = {
          deviceId: id,
          date: currentDateStr,
          time: currentTimeStr,
          timestamp: now
        };

        let hasRecordableData = false;
        
        // รวบรวมเฉพาะ Tag ที่ติ๊ก Record: True
        currentTags.forEach((tag, idx) => {
           if (tag.record && tag.script && newResults[idx] !== undefined) {
               const numValue = parseFloat(newResults[idx]);
               if(!isNaN(numValue)) {
                   dataToSave[tag.label || `Tag ${idx+1}`] = numValue;
                   hasRecordableData = true;
               }
           }
        });

        // ถ้ายิง API ไปเซฟเฉพาะตอนที่มีข้อมูลตัวเลขอยู่จริงๆ
        if (hasRecordableData && id !== 'create') {
            const auth = getAuth();
            if(auth) {
               fetch('/api/preferences/createDocument', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
                 body: JSON.stringify({ collection: historyCollectionName, data: dataToSave })
               }).catch(e => console.error("History Save Error:", e));
            }
        }
        // รีเซ็ตเวลานับถอยหลังใหม่
        lastDbSaveTime.current = now;
      }

    }, 1000); 

    return () => { isMounted = false; clearInterval(intervalId); };
  }, [id]); // เอา id มาเผื่อการสลับอุปกรณ์

  useEffect(() => {
    if (isCreateMode) { setDevice(prev => ({ ...prev, tags: [] })); return; }
    async function fetchData() {
      try {
        const auth = getAuth()
        if (!auth) return
        const resp = await fetch('/api/preferences/readDocument', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
          body: JSON.stringify({ collection: collectionName, query: { _id: id } })
        })
        const json = await resp.json()
        if (json && json.length > 0) {
          let loadedDevice = json[0];
          if (!loadedDevice.tags) loadedDevice.tags = [];
          setDevice(loadedDevice)
          setOriginalDevice(JSON.parse(JSON.stringify(loadedDevice)))
        } else {
          alert('Device not found'); navigate('/dashboard')
        }
      } catch (error) { console.error('Fetch error:', error) } 
      finally { setLoading(false) }
    }
    fetchData()
  }, [id, navigate, isCreateMode])

  const handleChange = (e) => {
    const { name, value } = e.target
    setDevice(prev => ({ ...prev, [name]: value }))
  }

  const handleTagChange = (index, field, value) => {
    const newTags = [...device.tags]; newTags[index][field] = value;
    setDevice(prev => ({ ...prev, tags: newTags }))
    if (field === 'updateInterval') lastRunTimes.current[index] = 0; 
  }

  const runTagScript = async (index, e) => {
    if (e) e.stopPropagation()
    const newErrors = { ...tagErrorsRef.current, [index]: null };
    const newResults = { ...tagResultsRef.current, [index]: null };
    setTagErrors(newErrors); tagErrorsRef.current = newErrors;
    setTagResults(newResults); tagResultsRef.current = newResults;
    try {
      const code = device.tags[index].script
      if (!code || !code.trim()) return
      const output = await jsexe(code)
      const successResults = { ...tagResultsRef.current, [index]: output };
      setTagResults(successResults); tagResultsRef.current = successResults;
      lastRunTimes.current[index] = Date.now(); 
    } catch (err) { 
      const failedErrors = { ...tagErrorsRef.current, [index]: err.message };
      setTagErrors(failedErrors); tagErrorsRef.current = failedErrors;
    }
  }

  const handleSave = async () => {
    try {
      if (!device._id || !device.name) { alert('Please fill ID and Name'); return }

      const currentStr = JSON.stringify(device);
      const originalStr = originalDevice ? JSON.stringify(originalDevice) : null;
      const isDataChanged = !originalDevice || currentStr !== originalStr;

      let dataToSave = { ...device };

      if (activeTab === 'dashboard') {
        if (!isDataChanged) { alert('No layout changes to save.'); return; }
        dataToSave.revision = (Number(dataToSave.revision) || 1) + 1;
      } 
      else {
        if (!isDataChanged && !isCreateMode) {
          const confirmNewTag = window.confirm('ข้อมูลไม่มีการเปลี่ยนแปลง\nต้องการสร้าง Tag ใหม่เพิ่ม 1 อัน ใช่หรือไม่?');
          if (!confirmNewTag) return;
        }
        dataToSave.revision = isCreateMode ? 1 : (Number(dataToSave.revision) || 1) + 1; 
        const nextTagNumber = dataToSave.tags.length + 1;
        const autoNewTag = { 
          label: `tag${nextTagNumber}`, script: '', updateInterval: '1sec', 
          record: true, sync: true, api: false, line: false, email: false, 
          alarm: 'Off', spLow: '25', spHigh: '35', critical: 'Low', title: '', alert: '', description: '',
          x: 50 + (nextTagNumber * 20), y: 50 + (nextTagNumber * 20)  
        };
        dataToSave.tags = [...dataToSave.tags, autoNewTag];
      }

      setSaving(true)
      const auth = getAuth()
      const url = isCreateMode ? '/api/preferences/createDocument' : '/api/preferences/updateDocument'
      
      const resp = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
        body: JSON.stringify({ collection: collectionName, data: dataToSave })
      })
      
      const json = await resp.json()
      if (json.error) throw new Error(json.error)

      setDevice(dataToSave)
      setOriginalDevice(JSON.parse(JSON.stringify(dataToSave))) 

      if (activeTab === 'dashboard') alert('Dashboard layout saved successfully!');
      else if (isCreateMode) { navigate(`/dashboard/${dataToSave._id}`, { replace: true }); alert('Device created!'); }
      else alert('Saved Device & Generated a new Tag successfully!');

    } catch (error) { alert('Error saving data: ' + error.message) } 
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if(!window.confirm(`Delete ${device.name}?`)) return;
    try {
        setSaving(true)
        const auth = getAuth()
        await fetch('/api/preferences/deleteDocument', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
            body: JSON.stringify({ collection: collectionName, query: { _id: device._id } })
        })
        navigate('/dashboard')
    } catch (error) { alert('Delete failed'); setSaving(false) }
  }

  const deleteTag = async (indexToRemove) => {
    if(!window.confirm(`Are you sure you want to delete Tag ${indexToRemove + 1}?`)) return;
    try {
      setSaving(true);
      const remainingTags = device.tags.filter((_, i) => i !== indexToRemove);
      const reorderedTags = remainingTags.map((tag, i) => ({ ...tag, label: `tag${i + 1}` }));

      if (isCreateMode) {
        setDevice(prev => ({ ...prev, tags: reorderedTags }));
        setTagResults({}); setSaving(false); return;
      }

      const dataToSave = { ...device, tags: reorderedTags, revision: (Number(device.revision) || 1) + 1 };
      const auth = getAuth();
      const resp = await fetch('/api/preferences/updateDocument', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
        body: JSON.stringify({ collection: collectionName, data: dataToSave })
      });
      const json = await resp.json();
      if (json.error) throw new Error(json.error);

      setDevice(dataToSave); setOriginalDevice(JSON.parse(JSON.stringify(dataToSave))); 
      const newResults = { ...tagResults }; delete newResults[indexToRemove];
      setTagResults(newResults); tagResultsRef.current = newResults;
      lastRunTimes.current = {}; 
      alert('Tag deleted and reordered successfully!');
    } catch (error) { alert('Error deleting tag: ' + error.message); } 
    finally { setSaving(false); }
  }

  const handleMouseDown = (e, indexOrType) => {
    e.preventDefault();
    setDraggingIdx(indexOrType); 
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (draggingIdx === null) return;
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    setDragStartPos({ x: e.clientX, y: e.clientY });

    if (draggingIdx === 'chart') {
      setDevice(prev => ({ ...prev, chartX: (prev.chartX || 200) + dx, chartY: (prev.chartY || 200) + dy }));
    } 
    else if (draggingIdx === 'datetime') {
      setDevice(prev => ({ ...prev, datetimeX: (prev.datetimeX || 500) + dx, datetimeY: (prev.datetimeY || 50) + dy }));
    } 
    else {
      const newTags = [...device.tags];
      newTags[draggingIdx].x = (newTags[draggingIdx].x || 50) + dx;
      newTags[draggingIdx].y = (newTags[draggingIdx].y || 50) + dy;
      setDevice(prev => ({ ...prev, tags: newTags }));
    }
  };

  const handleMouseUp = () => { setDraggingIdx(null); };

  if (loading) return <Page><Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box></Page>

  const inputProps = { 
    variant: "outlined", size: "small", fullWidth: true, 
    sx: { mb: 1, '& .MuiOutlinedInput-root': { backgroundColor: '#f9f9f9', borderRadius: '6px' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e0e0e0' } },
    InputProps: { style: { fontSize: '0.875rem' } }, 
    InputLabelProps: { shrink: true, style: { fontSize: '0.85rem', color: '#555', fontWeight: 'bold' } } 
  }

  return (
    <Page pageTitle={`Sites - ${device._id || 'New'}`}>
      <Box sx={{ padding: '0', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
        
        {/* Header Tabs */}
        <Box sx={{ px: 4, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconButton onClick={() => navigate('/dashboard')} size="small" sx={{ mr: -2 }}><ArrowBackIcon /></IconButton>
            <Typography onClick={() => setActiveTab('devices')} variant="subtitle1" sx={{ cursor: 'pointer', fontWeight: 'bold', color: activeTab === 'devices' ? '#1976d2' : '#999', borderBottom: activeTab === 'devices' ? '3px solid #1976d2' : '3px solid transparent', pb: 0.5, transition: '0.2s' }}>DEVICES</Typography>
            <Typography onClick={() => setActiveTab('dashboard')} variant="subtitle1" sx={{ cursor: 'pointer', fontWeight: 'bold', color: activeTab === 'dashboard' ? '#1976d2' : '#999', borderBottom: activeTab === 'dashboard' ? '3px solid #1976d2' : '3px solid transparent', pb: 0.5, transition: '0.2s' }}>DASHBOARD</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!isCreateMode && <Button color="error" onClick={handleDelete} size="small">DELETE</Button>}
            <Button onClick={handleSave} disabled={saving} size="small" variant="contained" sx={{ fontWeight: 'bold' }}>
              {saving ? 'SAVING...' : 'SAVE'}
            </Button>
          </Box>
        </Box>

        {/* ======================= หน้า DEVICES ======================= */}
        {activeTab === 'devices' && (
          <Box sx={{ p: 4, overflowY: 'auto', flex: 1 }}>
            <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>{isCreateMode ? 'Add New Device' : 'Edit Device Info'}</Typography>
            <Box sx={{ mb: 4, p: 3, border: '1px solid #f0f0f0', borderRadius: '8px', bgcolor: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <Grid container spacing={3} sx={{ mb: 1 }}>
                <Grid item xs={2}><TextField {...inputProps} label="Device ID" name="_id" value={device._id} onChange={handleChange} disabled={!isCreateMode} /></Grid>
                <Grid item xs={2}><TextField {...inputProps} label="Code" name="code" value={device.code} onChange={handleChange} /></Grid>
                <Grid item xs={3}><TextField {...inputProps} label="Connection" name="connection" value={device.connection} onChange={handleChange} /></Grid>
                <Grid item xs={3}><TextField {...inputProps} label="Model" name="model" value={device.model} onChange={handleChange} /></Grid>
                <Grid item xs={2}><TextField {...inputProps} label="IP Addr / Port Name" name="ipAddr" value={device.ipAddr} onChange={handleChange} /></Grid>
              </Grid>
              <Grid container spacing={3} sx={{ mb: 1 }}>
                <Grid item xs={4}><TextField {...inputProps} label="Device Name" name="name" value={device.name} onChange={handleChange} /></Grid>
                <Grid item xs={6}><TextField {...inputProps} label="Remark" name="remark" value={device.remark} onChange={handleChange} /></Grid>
                <Grid item xs={2}><TextField {...inputProps} label="API-Code" name="apiCode" value={device.apiCode} onChange={handleChange} /></Grid>
              </Grid>
              <Grid container spacing={3} sx={{ mb: 1 }}>
                <Grid item xs={6}><TextField {...inputProps} label="Line Channel" name="lineChannel" value={device.lineChannel} onChange={handleChange} /></Grid>
                <Grid item xs={6}><TextField {...inputProps} label="Line ID" name="lineId" value={device.lineId} onChange={handleChange} /></Grid>
              </Grid>
              <Grid container spacing={3} sx={{ mb: 2 }}>
                <Grid item xs={4}><TextField {...inputProps} label="Email From" name="emailFrom" value={device.emailFrom} onChange={handleChange} /></Grid>
                <Grid item xs={4}><TextField {...inputProps} label="Email Password" name="emailPwd" value={device.emailPwd} type="password" onChange={handleChange} /></Grid>
                <Grid item xs={4}><TextField {...inputProps} label="Email To" name="emailTo" value={device.emailTo} onChange={handleChange} /></Grid>
              </Grid>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, pt: 2, borderTop: '1px solid #eee' }}>
                <FileCopyIcon sx={{ color: '#888', cursor: 'pointer', fontSize: 20 }} />
                <FormControlLabel control={<Checkbox size="small" />} label={<Typography variant="caption">Stop</Typography>} />
                <FormControlLabel control={<Checkbox size="small" checked />} label={<Typography variant="caption">Record</Typography>} />
                <FormControlLabel control={<Checkbox size="small" />} label={<Typography variant="caption">Sync</Typography>} />
                <FormControlLabel control={<Checkbox size="small" />} label={<Typography variant="caption">API</Typography>} />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'flex-end' }}>
                <Typography variant="h6" fontWeight="bold" sx={{ color: '#444' }}>Tags Configuration</Typography>
            </Box>

            {device.tags.map((tag, index) => (
              <Accordion key={index} expanded={expandedPanel === `panel${index}`} onChange={(e, isExpanded) => setExpandedPanel(isExpanded ? `panel${index}` : false)} disableGutters elevation={1} sx={{ border: '1px solid #e0e0e0', mb: 1, borderRadius: '4px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, bgcolor: expandedPanel === `panel${index}` ? '#f5f9ff' : '#fff' }}>
                  <Grid container alignItems="center">
                    <Grid item xs={3} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                      <Typography variant="body1" fontWeight="bold" sx={{ color: '#333' }}>{tag.label || `Tag ${index+1}`}</Typography>
                    </Grid>
                    <Grid item xs={4} sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{tagResults[index] !== null && tagResults[index] !== undefined ? String(tagResults[index]) : ''}</Typography>
                    </Grid>
                    <Grid item xs={5} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <FormControlLabel onClick={(e)=>e.stopPropagation()} control={<Checkbox size="small" checked={tag.record} onChange={(e) => handleTagChange(index, 'record', e.target.checked)} color="success" />} label={<Typography variant="caption">Record</Typography>} />
                      <FormControlLabel onClick={(e)=>e.stopPropagation()} control={<Checkbox size="small" checked={tag.sync} onChange={(e) => handleTagChange(index, 'sync', e.target.checked)} color="success" />} label={<Typography variant="caption">Sync</Typography>} />
                      <FormControlLabel onClick={(e)=>e.stopPropagation()} control={<Checkbox size="small" checked={tag.api} onChange={(e) => handleTagChange(index, 'api', e.target.checked)} color="default" />} label={<Typography variant="caption">API</Typography>} />
                    </Grid>
                  </Grid>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 3, borderTop: '1px solid #eee' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}><Button color="error" variant="outlined" size="small" onClick={() => deleteTag(index)}>Delete Tag</Button></Box>
                  <Grid container spacing={3} alignItems="flex-start" sx={{ mb: 2 }}>
                    <Grid item xs={3}><TextField {...inputProps} label="Label" value={tag.label} onChange={(e) => handleTagChange(index, 'label', e.target.value)} /></Grid>
                    <Grid item xs={3}>
                      <TextField select {...inputProps} label="Update Interval" value={tag.updateInterval || '1sec'} onChange={(e) => handleTagChange(index, 'updateInterval', e.target.value)}>
                        <MenuItem value="1sec">1 sec</MenuItem><MenuItem value="15sec">15 sec</MenuItem><MenuItem value="30sec">30 sec</MenuItem><MenuItem value="1min">1 min</MenuItem><MenuItem value="daily">Daily</MenuItem><MenuItem value="week">Weekly</MenuItem><MenuItem value="month">Monthly</MenuItem><MenuItem value="year">Yearly</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={6} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                      <FormControlLabel control={<Checkbox size="small" checked={tag.record} onChange={(e)=>handleTagChange(index, 'record', e.target.checked)} color="default"/>} label={<Typography variant="body2">Record</Typography>} />
                      <FormControlLabel control={<Checkbox size="small" checked={tag.sync} onChange={(e)=>handleTagChange(index, 'sync', e.target.checked)} color="default"/>} label={<Typography variant="body2">Sync</Typography>} />
                      <FormControlLabel control={<Checkbox size="small" checked={tag.api} onChange={(e)=>handleTagChange(index, 'api', e.target.checked)} color="default"/>} label={<Typography variant="body2">API</Typography>} />
                      <FormControlLabel control={<Checkbox size="small" checked={tag.line} onChange={(e)=>handleTagChange(index, 'line', e.target.checked)} color="default"/>} label={<Typography variant="body2">LINE</Typography>} />
                      <FormControlLabel control={<Checkbox size="small" checked={tag.email} onChange={(e)=>handleTagChange(index, 'email', e.target.checked)} color="default"/>} label={<Typography variant="body2">EMAIL</Typography>} />
                    </Grid>
                  </Grid>
                  <Typography variant="subtitle2" sx={{ color: '#555', mb: 1 }}>Script Engine</Typography>
                  <TextField fullWidth multiline minRows={4} variant="outlined" value={tag.script} onChange={(e) => handleTagChange(index, 'script', e.target.value)} sx={{ bgcolor: '#f5f5f5', mb: 1, '& input, & textarea': { fontSize: '0.875rem', fontFamily: 'monospace', color: '#333' } }} />
                  <Box sx={{ textAlign: 'right', mb: 2 }}><Button variant="contained" color="secondary" size="small" startIcon={<PlayArrowIcon/>} onClick={(e) => runTagScript(index, e)}>TEST SCRIPT</Button></Box>
                  <Typography variant="subtitle2" sx={{ color: '#555', mb: 1 }}>Console Output (Real-time)</Typography>
                  <Box sx={{ p: 2, bgcolor: '#282c34', color: '#fff', borderRadius: '4px', minHeight: '80px', mb: 4, fontSize: '0.9rem', fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
                    {tagErrors[index] ? <Typography color="error">{tagErrors[index]}</Typography> : tagResults[index] !== null && tagResults[index] !== undefined ? <Typography sx={{ color: '#98c379', fontWeight: 'bold' }}>{String(tagResults[index])}</Typography> : <Typography variant="caption" sx={{ color: '#5c6370' }}>Waiting for execution...</Typography>}
                  </Box>
                  <Typography variant="subtitle2" sx={{ color: '#555', mb: 1 }}>Alarm Settings</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={2}><TextField select {...inputProps} label="Alarm" value={tag.alarm} onChange={(e) => handleTagChange(index, 'alarm', e.target.value)}><MenuItem value="Off">Off</MenuItem><MenuItem value="On">On</MenuItem></TextField></Grid>
                    <Grid item xs={2}><TextField {...inputProps} label="Set Point Low" value={tag.spLow} onChange={(e) => handleTagChange(index, 'spLow', e.target.value)} /></Grid>
                    <Grid item xs={2}><TextField {...inputProps} label="Set Point High" value={tag.spHigh} onChange={(e) => handleTagChange(index, 'spHigh', e.target.value)} /></Grid>
                    <Grid item xs={2}><TextField select {...inputProps} label="Critical Level" value={tag.critical} onChange={(e) => handleTagChange(index, 'critical', e.target.value)}><MenuItem value="Low">Low</MenuItem><MenuItem value="High">High</MenuItem></TextField></Grid>
                    <Grid item xs={4}><TextField {...inputProps} label="Title" value={tag.title} onChange={(e) => handleTagChange(index, 'title', e.target.value)} /></Grid>
                    <Grid item xs={4}><TextField {...inputProps} label="Alert Message" value={tag.alert} onChange={(e) => handleTagChange(index, 'alert', e.target.value)} /></Grid>
                    <Grid item xs={8}><TextField {...inputProps} label="Description" value={tag.description} onChange={(e) => handleTagChange(index, 'description', e.target.value)} /></Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {/* ======================= หน้า DASHBOARD ======================= */}
        {activeTab === 'dashboard' && (
          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            {/* พื้นที่ลากวาง (Canvas) */}
            <Box 
              sx={{ flex: 1, position: 'relative', bgcolor: '#f4f6f8', backgroundImage: 'radial-gradient(#ddd 1px, transparent 0)', backgroundSize: '20px 20px' }}
              onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} 
            >
              {/* --- 1. กล่อง Tag ปกติ --- */}
              {device.tags.map((tag, index) => {
                if(!tag.script || !tag.script.trim()) return null; 
                return (
                  <Box
                    key={index} onMouseDown={(e) => handleMouseDown(e, index)}
                    sx={{ position: 'absolute', left: tag.x !== undefined ? tag.x : 50 + (index*20), top: tag.y !== undefined ? tag.y : 50 + (index*20), width: 140, height: 80, bgcolor: '#fff', border: draggingIdx === index ? '2px solid #1976d2' : '1px solid #ccc', boxShadow: draggingIdx === index ? 6 : 1, borderRadius: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: draggingIdx === index ? 'grabbing' : 'grab', userSelect: 'none', zIndex: draggingIdx === index ? 10 : 1 }}
                  >
                    <Typography variant="body1" sx={{ color: '#333', fontWeight: 'bold' }}>{tagResults[index] !== null && tagResults[index] !== undefined ? String(tagResults[index]) : '...'}</Typography>
                    <Typography variant="caption" sx={{ color: '#888', mt: 0.5 }}>{tag.label || `Tag ${index+1}`}</Typography>
                  </Box>
                )
              })}

              {/* --- 2. กล่องกราฟ (Line Chart) --- */}
              {device.showChart && (
                <Box
                  onMouseDown={(e) => handleMouseDown(e, 'chart')}
                  sx={{
                    position: 'absolute',
                    left: device.chartX || 200, top: device.chartY || 200,
                    width: 650, height: 400, 
                    bgcolor: '#fff',
                    border: draggingIdx === 'chart' ? '2px solid #ff9800' : '1px solid #ccc',
                    boxShadow: draggingIdx === 'chart' ? 6 : 2,
                    borderRadius: 2, p: 2,
                    display: 'flex', flexDirection: 'column',
                    cursor: draggingIdx === 'chart' ? 'grabbing' : 'grab',
                    zIndex: draggingIdx === 'chart' ? 10 : 2
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }} onMouseDown={e => e.stopPropagation() }>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#555' }}>
                      {isHistoricalMode ? `Mixed Chart (History: ${selectedDate})` : 'Mixed Chart (Live Data)'}
                    </Typography>
                    <IconButton size="small" onClick={() => setDevice(prev => ({ ...prev, showChart: false }))}>
                      <CloseIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ flex: 1, width: '100%', position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
                    
                    {isChartLoading && (
                      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.7)', zIndex: 5 }}>
                        <CircularProgress size={30} />
                        <Typography sx={{ ml: 2, color: '#888', fontWeight: 'bold' }}>Loading History...</Typography>
                      </Box>
                    )}

                    {!isChartLoading && isHistoricalMode && historicalChartData.length === 0 && (
                      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4 }}>
                        <Typography sx={{ color: '#aaa', fontStyle: 'italic' }}>ไม่มีการเก็บบันทึกข้อมูลในวันที่เลือก (No data recorded)</Typography>
                      </Box>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={isHistoricalMode ? historicalChartData : realtimeChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="time" tick={{fontSize: 12}} tickLine={false} />
                        <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                        <Tooltip />
                        {device.tags.map((tag, index) => {
                           if (!tag.script || !tag.script.trim() || !tag.record) return null; 
                           return (
                             <Line 
                               key={index} type="monotone" 
                               dataKey={tag.label || `Tag ${index + 1}`} 
                               stroke={CHART_COLORS[index % CHART_COLORS.length]} 
                               strokeWidth={2} dot={isHistoricalMode} 
                               isAnimationActive={isHistoricalMode}  
                             />
                           )
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              )}

              {/* --- 3. กล่อง Datetime (Date Selection) --- */}
              {device.showDatetime && (
                <Box
                  onMouseDown={(e) => handleMouseDown(e, 'datetime')}
                  sx={{
                    position: 'absolute',
                    left: device.datetimeX || 500, top: device.datetimeY || 50,
                    width: 280, bgcolor: '#fff',
                    border: draggingIdx === 'datetime' ? '2px solid #e91e63' : '1px solid #ccc',
                    boxShadow: draggingIdx === 'datetime' ? 6 : 2,
                    borderRadius: 2, p: 2,
                    display: 'flex', flexDirection: 'column',
                    cursor: draggingIdx === 'datetime' ? 'grabbing' : 'grab',
                    zIndex: draggingIdx === 'datetime' ? 10 : 3
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }} onMouseDown={e => e.stopPropagation()}>
                     <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#555', display: 'flex', alignItems: 'center', gap: 1 }}>
                       <DateRangeIcon fontSize="small" sx={{ color: '#e91e63' }} /> 
                       Date Selection
                     </Typography>
                     <IconButton size="small" onClick={() => setDevice(prev => ({ ...prev, showDatetime: false }))}>
                       <CloseIcon fontSize="small" />
                     </IconButton>
                  </Box>
                  
                  <Box onMouseDown={e => e.stopPropagation()}>
                     <TextField
                       type="date" size="small" fullWidth value={selectedDate}
                       onChange={(e) => setSelectedDate(e.target.value)}
                       inputProps={{ max: today }} 
                       sx={{ bgcolor: '#f9f9f9', '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
                     />
                     <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#888', textAlign: 'center' }}>
                       Select a past date to view history.
                     </Typography>
                  </Box>
                </Box>
              )}

            </Box>

            {/* --- แถบเครื่องมือขวามือ (Tools) --- */}
            <Box sx={{ width: 250, bgcolor: '#fff', borderLeft: '1px solid #ddd', p: 0, overflowY: 'auto' }}>
               <Box sx={{ p: 2, bgcolor: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
                 <Typography variant="subtitle2" fontWeight="bold">Tools</Typography>
               </Box>
               <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' }, p: 0.5 }}>
                    <TextFieldsIcon sx={{ color: '#f44336' }} /> <Typography variant="body2">Textbox</Typography>
                  </Box>

                  <Box onClick={() => setDevice(prev => ({ ...prev, showChart: true }))} sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' }, bgcolor: device.showChart ? '#fff3e0' : 'transparent', p: 0.5, borderRadius: 1 }}>
                    <InsertChartIcon sx={{ color: '#ff9800' }} /> <Typography variant="body2" fontWeight={device.showChart ? 'bold' : 'normal'}>Chart</Typography>
                  </Box>

                  <Box onClick={() => setDevice(prev => ({ ...prev, showDatetime: true }))} sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' }, bgcolor: device.showDatetime ? '#fce4ec' : 'transparent', p: 0.5, borderRadius: 1 }}>
                    <DateRangeIcon sx={{ color: '#e91e63' }} /> <Typography variant="body2" fontWeight={device.showDatetime ? 'bold' : 'normal'}>Datetime</Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' }, p: 0.5 }}>
                    <SpeedIcon sx={{ color: '#9c27b0' }} /> <Typography variant="body2">Gauge</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' }, p: 0.5 }}>
                    <MapIcon sx={{ color: '#4caf50' }} /> <Typography variant="body2">Map</Typography>
                  </Box>

                  <Divider sx={{ my: 1 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 0.5 }}>
                    * Click tool to open, drag on canvas to arrange.
                  </Typography>
               </Box>
            </Box>

          </Box>
        )}

      </Box>
    </Page>
  )
}

export default DevicePage