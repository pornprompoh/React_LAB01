import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Page from '../../containers/Page/Page'
import {
  Box, Button, TextField, Typography, Grid, MenuItem, CircularProgress,
  FormControlLabel, Checkbox, IconButton, Accordion, AccordionSummary, AccordionDetails, Divider, Paper
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CloseIcon from '@mui/icons-material/Close'
import SaveIcon from '@mui/icons-material/Save'

import TextFieldsIcon from '@mui/icons-material/TextFields'
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined'
import SpeedIcon from '@mui/icons-material/Speed'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import DateRangeIcon from '@mui/icons-material/DateRange' 

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// เปลี่ยนชุดสีของกราฟให้ดู Modern ขึ้น
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#f43f5e'];

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
  const historyCollectionName = 'HistoryData'

  const [loading, setLoading] = useState(!isCreateMode)
  const [saving, setSaving] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState(false) 
  
  const [activeTab, setActiveTab] = useState('devices') 
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  
  const today = new Date().toISOString().split('T')[0]; 
  const [selectedDate, setSelectedDate] = useState(today); 
  const [realtimeChartData, setRealtimeChartData] = useState([]);

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
  const lastDbSaveTime = useRef(Date.now()) 

  function getAuth() {
    let auth = null
    const item = localStorage.getItem('base-shell:auth')
    if (item) auth = JSON.parse(item)
    return auth
  }

  useEffect(() => { tagsRef.current = device.tags }, [device.tags])

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
          
          const resp = await fetch('/api/preferences/readDocument', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
            body: JSON.stringify({ 
              collection: historyCollectionName, 
              query: { deviceId: id, date: selectedDate },
            })
          });

          const json = await resp.json();
          if (Array.isArray(json) && json.length > 0) {
            json.sort((a, b) => a.timestamp - b.timestamp);
            setHistoricalChartData(json);
          } else {
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

  useEffect(() => {
    let isMounted = true;
    const intervalId = setInterval(async () => {
      const currentTags = tagsRef.current;
      if (!currentTags || currentTags.length === 0) return;

      const now = Date.now();
      let hasUpdates = false; 

      const newResults = { ...tagResultsRef.current };
      const newErrors = { ...tagErrorsRef.current };

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

        setRealtimeChartData(prev => {
           const newData = [...prev, newChartPoint];
           if (newData.length > 30) newData.shift(); 
           return newData;
        });
      }

      if (now - lastDbSaveTime.current >= 60000) {
        const currentDateStr = new Date().toISOString().split('T')[0]; 
        const currentTimeStr = new Date().toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute:'2-digit' }); 
        
        let dataToSave = { deviceId: id, date: currentDateStr, time: currentTimeStr, timestamp: now };
        let hasRecordableData = false;
        
        currentTags.forEach((tag, idx) => {
           if (tag.record && tag.script && newResults[idx] !== undefined) {
               const numValue = parseFloat(newResults[idx]);
               if(!isNaN(numValue)) {
                   dataToSave[tag.label || `Tag ${idx+1}`] = numValue;
                   hasRecordableData = true;
               }
           }
        });

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
        lastDbSaveTime.current = now;
      }
    }, 1000); 

    return () => { isMounted = false; clearInterval(intervalId); };
  }, [id]); 

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

  if (loading) return <Page><Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', mt: 10 }}><CircularProgress sx={{color: '#6366f1'}}/></Box></Page>

  // ดีไซน์ใหม่ของช่อง Input
  const inputProps = { 
    variant: "outlined", size: "small", fullWidth: true, 
    sx: { 
      mb: 1.5, 
      '& .MuiOutlinedInput-root': { 
        borderRadius: '10px', 
        bgcolor: '#f8fafc',
        '& fieldset': { borderColor: '#e2e8f0' },
        '&:hover fieldset': { borderColor: '#cbd5e1' },
        '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: '2px' }
      } 
    },
    InputProps: { style: { fontSize: '0.875rem', color: '#334155' } }, 
    InputLabelProps: { shrink: true, style: { fontSize: '0.85rem', color: '#64748b', fontWeight: '600' } } 
  }

  return (
    <Page pageTitle={`Device Setup : ${device._id || 'New Workspace'}`}>
      <Box sx={{ padding: '0', height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', bgcolor: '#f1f5f9' }}>
        
        {/* HEADER BAR รูปแบบใหม่สไตล์แอปสมัยใหม่ */}
        <Paper elevation={0} sx={{ px: 4, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff', zIndex: 10 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <IconButton onClick={() => navigate('/dashboard')} size="small" sx={{ mr: -1, bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
               <ArrowBackIcon fontSize="small" sx={{ color: '#475569' }} />
            </IconButton>
            
            {/* TABS แบบแคปซูล (Pill shaped) */}
            <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', p: 0.5, borderRadius: '12px' }}>
              <Button 
                disableElevation
                onClick={() => setActiveTab('devices')} 
                variant={activeTab === 'devices' ? 'contained' : 'text'}
                sx={{ 
                  borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', px: 3,
                  bgcolor: activeTab === 'devices' ? '#ffffff' : 'transparent',
                  color: activeTab === 'devices' ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === 'devices' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  '&:hover': { bgcolor: activeTab === 'devices' ? '#ffffff' : '#e2e8f0' }
                }}
              >
                Configuration
              </Button>
              <Button 
                disableElevation
                onClick={() => setActiveTab('dashboard')} 
                variant={activeTab === 'dashboard' ? 'contained' : 'text'}
                sx={{ 
                  borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', px: 3,
                  bgcolor: activeTab === 'dashboard' ? '#ffffff' : 'transparent',
                  color: activeTab === 'dashboard' ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === 'dashboard' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                  '&:hover': { bgcolor: activeTab === 'dashboard' ? '#ffffff' : '#e2e8f0' }
                }}
              >
                Live Dashboard
              </Button>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!isCreateMode && (
               <Button color="error" variant="outlined" onClick={handleDelete} size="small" startIcon={<DeleteOutlineIcon/>} sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}>
                 Remove
               </Button>
            )}
            <Button onClick={handleSave} disabled={saving} size="small" variant="contained" startIcon={<SaveIcon/>} sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 'bold', bgcolor: '#4f46e5', '&:hover': { bgcolor: '#4338ca' } }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Paper>

        {/* ======================= หน้า CONFIGURATION (DEVICES) ======================= */}
        {activeTab === 'devices' && (
          <Box sx={{ p: 4, overflowY: 'auto', flex: 1 }}>
            
            {/* ฟอร์มการตั้งค่า */}
            <Paper elevation={0} sx={{ mb: 4, p: 4, border: '1px solid #e2e8f0', borderRadius: '20px', bgcolor: '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.02)' }}>
              <Typography variant="h6" sx={{ color: '#1e293b', mb: 3, fontWeight: '700' }}>Device Information</Typography>
              <Grid container spacing={3} sx={{ mb: 1 }}>
                <Grid item xs={2}><TextField {...inputProps} label="Device ID" name="_id" value={device._id} onChange={handleChange} disabled={!isCreateMode} /></Grid>
                <Grid item xs={2}><TextField {...inputProps} label="Hardware Code" name="code" value={device.code} onChange={handleChange} /></Grid>
                <Grid item xs={3}><TextField {...inputProps} label="Connection Type" name="connection" value={device.connection} onChange={handleChange} /></Grid>
                <Grid item xs={3}><TextField {...inputProps} label="Model Name" name="model" value={device.model} onChange={handleChange} /></Grid>
                <Grid item xs={2}><TextField {...inputProps} label="IP / Port" name="ipAddr" value={device.ipAddr} onChange={handleChange} /></Grid>
              </Grid>
              <Grid container spacing={3} sx={{ mb: 1 }}>
                <Grid item xs={4}><TextField {...inputProps} label="Display Name" name="name" value={device.name} onChange={handleChange} /></Grid>
                <Grid item xs={6}><TextField {...inputProps} label="Notes / Remark" name="remark" value={device.remark} onChange={handleChange} /></Grid>
                <Grid item xs={2}><TextField {...inputProps} label="API Secret" name="apiCode" value={device.apiCode} onChange={handleChange} /></Grid>
              </Grid>
              
              <Divider sx={{ my: 3, borderColor: '#f1f5f9' }} />
              <Typography variant="subtitle2" sx={{ color: '#64748b', mb: 2, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Notifications Setup</Typography>

              <Grid container spacing={3} sx={{ mb: 1 }}>
                <Grid item xs={6}><TextField {...inputProps} label="Line Channel Token" name="lineChannel" value={device.lineChannel} onChange={handleChange} /></Grid>
                <Grid item xs={6}><TextField {...inputProps} label="Line User ID" name="lineId" value={device.lineId} onChange={handleChange} /></Grid>
              </Grid>
              <Grid container spacing={3} sx={{ mb: 1 }}>
                <Grid item xs={4}><TextField {...inputProps} label="Sender Email" name="emailFrom" value={device.emailFrom} onChange={handleChange} /></Grid>
                <Grid item xs={4}><TextField {...inputProps} label="Email App Password" name="emailPwd" value={device.emailPwd} type="password" onChange={handleChange} /></Grid>
                <Grid item xs={4}><TextField {...inputProps} label="Receiver Email" name="emailTo" value={device.emailTo} onChange={handleChange} /></Grid>
              </Grid>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="700" sx={{ color: '#1e293b' }}>Sensors & Tags</Typography>
            </Box>

            {/* ดีไซน์กล่อง Tag ใหม่ให้ดูเป็นแผงควบคุมสวยๆ */}
            {device.tags.map((tag, index) => (
              <Accordion 
                key={index} 
                expanded={expandedPanel === `panel${index}`} 
                onChange={(e, isExpanded) => setExpandedPanel(isExpanded ? `panel${index}` : false)} 
                disableGutters 
                elevation={0} 
                sx={{ 
                  mb: 2, 
                  border: expandedPanel === `panel${index}` ? '1px solid #818cf8' : '1px solid #e2e8f0', 
                  borderRadius: '16px !important', 
                  overflow: 'hidden',
                  boxShadow: expandedPanel === `panel${index}` ? '0 10px 25px rgba(99, 102, 241, 0.1)' : '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease',
                  '&:before': { display: 'none' } 
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{color: '#64748b'}} />} sx={{ px: 3, py: 1, bgcolor: expandedPanel === `panel${index}` ? '#eef2ff' : '#ffffff' }}>
                  <Grid container alignItems="center">
                    <Grid item xs={4} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: tag.record ? '#10b981' : '#cbd5e1' }} />
                      <Typography variant="subtitle1" fontWeight="700" sx={{ color: '#1e293b' }}>{tag.label || `Sensor Tag ${index+1}`}</Typography>
                    </Grid>
                    <Grid item xs={4} sx={{ textAlign: 'center' }}>
                      <Box sx={{ display: 'inline-block', px: 2, py: 0.5, bgcolor: '#f1f5f9', borderRadius: '8px' }}>
                         <Typography variant="body2" sx={{ color: '#4f46e5', fontWeight: '800', fontFamily: 'monospace' }}>
                           Value: {tagResults[index] !== null && tagResults[index] !== undefined ? String(tagResults[index]) : '--'}
                         </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                      <FormControlLabel onClick={(e)=>e.stopPropagation()} control={<Checkbox size="small" checked={tag.record} onChange={(e) => handleTagChange(index, 'record', e.target.checked)} sx={{color: '#10b981', '&.Mui-checked': { color: '#10b981' }}} />} label={<Typography variant="caption" fontWeight="bold">Record</Typography>} />
                      <FormControlLabel onClick={(e)=>e.stopPropagation()} control={<Checkbox size="small" checked={tag.sync} onChange={(e) => handleTagChange(index, 'sync', e.target.checked)} sx={{color: '#6366f1', '&.Mui-checked': { color: '#6366f1' }}} />} label={<Typography variant="caption" fontWeight="bold">Sync</Typography>} />
                    </Grid>
                  </Grid>
                </AccordionSummary>
                
                <AccordionDetails sx={{ p: 4, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                     <Button color="error" variant="text" size="small" startIcon={<DeleteOutlineIcon/>} onClick={() => deleteTag(index)} sx={{ textTransform: 'none' }}>Remove Tag</Button>
                  </Box>
                  <Grid container spacing={3} alignItems="flex-start" sx={{ mb: 3 }}>
                    <Grid item xs={3}><TextField {...inputProps} label="Tag Label" value={tag.label} onChange={(e) => handleTagChange(index, 'label', e.target.value)} /></Grid>
                    <Grid item xs={3}>
                      <TextField select {...inputProps} label="Refresh Rate" value={tag.updateInterval || '1sec'} onChange={(e) => handleTagChange(index, 'updateInterval', e.target.value)}>
                        <MenuItem value="1sec">1 Second</MenuItem><MenuItem value="15sec">15 Seconds</MenuItem><MenuItem value="30sec">30 Seconds</MenuItem><MenuItem value="1min">1 Minute</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={6} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', pt: 1 }}>
                      {/* Chips สไตล์ */}
                      {['api', 'line', 'email'].map((service) => (
                         <FormControlLabel key={service} control={<Checkbox size="small" checked={tag[service]} onChange={(e)=>handleTagChange(index, service, e.target.checked)} color="default"/>} label={<Typography variant="body2" sx={{textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b'}}>{service}</Typography>} sx={{ bgcolor: '#f8fafc', pr: 2, borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      ))}
                    </Grid>
                  </Grid>
                  
                  <Typography variant="subtitle2" sx={{ color: '#475569', mb: 1, fontWeight: 'bold' }}>Javascript Engine</Typography>
                  <TextField fullWidth multiline minRows={4} variant="outlined" value={tag.script} onChange={(e) => handleTagChange(index, 'script', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#1e293b', borderRadius: '12px', '& fieldset': {border: 'none'} }, '& textarea': { fontSize: '0.9rem', fontFamily: 'monospace', color: '#38bdf8' } }} />
                  
                  <Box sx={{ textAlign: 'right', mt: 2, mb: 3 }}><Button variant="contained" size="small" startIcon={<PlayArrowIcon/>} onClick={(e) => runTagScript(index, e)} sx={{ bgcolor: '#10b981', '&:hover': {bgcolor: '#059669'}, borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' }}>Run Test</Button></Box>
                  
                  <Typography variant="subtitle2" sx={{ color: '#475569', mb: 1, fontWeight: 'bold' }}>Output Result</Typography>
                  <Box sx={{ p: 2, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', color: '#334155', borderRadius: '12px', minHeight: '60px', mb: 4, fontSize: '0.9rem', fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
                    {tagErrors[index] ? <Typography color="error" fontWeight="bold">{tagErrors[index]}</Typography> : tagResults[index] !== null && tagResults[index] !== undefined ? <Typography sx={{ color: '#4f46e5', fontWeight: 'bold' }}>{String(tagResults[index])}</Typography> : <Typography variant="caption" sx={{ color: '#94a3b8' }}>Awaiting execution...</Typography>}
                  </Box>
                  
                  <Typography variant="subtitle2" sx={{ color: '#64748b', mb: 2, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Threshold & Alarms</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={2}><TextField select {...inputProps} label="Alarm Status" value={tag.alarm} onChange={(e) => handleTagChange(index, 'alarm', e.target.value)}><MenuItem value="Off">Disabled</MenuItem><MenuItem value="On">Enabled</MenuItem></TextField></Grid>
                    <Grid item xs={2}><TextField {...inputProps} label="Min Point" value={tag.spLow} onChange={(e) => handleTagChange(index, 'spLow', e.target.value)} /></Grid>
                    <Grid item xs={2}><TextField {...inputProps} label="Max Point" value={tag.spHigh} onChange={(e) => handleTagChange(index, 'spHigh', e.target.value)} /></Grid>
                    <Grid item xs={2}><TextField select {...inputProps} label="Severity" value={tag.critical} onChange={(e) => handleTagChange(index, 'critical', e.target.value)}><MenuItem value="Low">Low</MenuItem><MenuItem value="High">High</MenuItem></TextField></Grid>
                    <Grid item xs={4}><TextField {...inputProps} label="Alert Title" value={tag.title} onChange={(e) => handleTagChange(index, 'title', e.target.value)} /></Grid>
                    <Grid item xs={12}><TextField {...inputProps} label="Alert Message" value={tag.alert} onChange={(e) => handleTagChange(index, 'alert', e.target.value)} /></Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {/* ======================= หน้า DASHBOARD ======================= */}
        {/* สลับ Layout ย้ายแถบ Tools มาไว้ซ้าย และเปลี่ยนพื้นหลังกระดาน */}
        {activeTab === 'dashboard' && (
          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'row-reverse' }}>
            
            {/* พื้นที่ลากวาง (Canvas) - เปลี่ยนเป็น Grid Line แบบสมุดกราฟ ดูเท่ขึ้น */}
            <Box 
              sx={{ 
                flex: 1, position: 'relative', bgcolor: '#f8fafc', 
                backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', 
                backgroundSize: '20px 20px',
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.02)'
              }}
              onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} 
            >
              {/* --- 1. กล่อง Tag เปลี่ยนดีไซน์ให้ขอบมน มีเงา --- */}
              {device.tags.map((tag, index) => {
                if(!tag.script || !tag.script.trim()) return null; 
                return (
                  <Box
                    key={index} onMouseDown={(e) => handleMouseDown(e, index)}
                    sx={{ position: 'absolute', left: tag.x !== undefined ? tag.x : 50 + (index*20), top: tag.y !== undefined ? tag.y : 50 + (index*20), width: 150, height: 90, bgcolor: '#ffffff', border: draggingIdx === index ? '2px solid #6366f1' : '1px solid #e2e8f0', boxShadow: draggingIdx === index ? '0 10px 25px rgba(99,102,241,0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: draggingIdx === index ? 'grabbing' : 'grab', userSelect: 'none', zIndex: draggingIdx === index ? 10 : 1, transition: draggingIdx === index ? 'none' : 'box-shadow 0.2s' }}
                  >
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>{tag.label || `Tag ${index+1}`}</Typography>
                    <Typography variant="h5" sx={{ color: '#0f172a', fontWeight: '800', fontFamily: 'monospace' }}>{tagResults[index] !== null && tagResults[index] !== undefined ? String(tagResults[index]) : '...'}</Typography>
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
                    width: 700, height: 420, 
                    bgcolor: '#ffffff',
                    border: draggingIdx === 'chart' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                    boxShadow: draggingIdx === 'chart' ? '0 15px 30px rgba(139,92,246,0.2)' : '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                    borderRadius: '20px', p: 3,
                    display: 'flex', flexDirection: 'column',
                    cursor: draggingIdx === 'chart' ? 'grabbing' : 'grab',
                    zIndex: draggingIdx === 'chart' ? 10 : 2
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }} onMouseDown={e => e.stopPropagation() }>
                    <Box>
                      <Typography variant="h6" fontWeight="800" sx={{ color: '#1e293b' }}>
                        {isHistoricalMode ? 'Historical Analysis' : 'Live Telemetry'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        {isHistoricalMode ? `Data from: ${selectedDate}` : 'Real-time updating parameters'}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setDevice(prev => ({ ...prev, showChart: false }))} sx={{ bgcolor: '#f1f5f9', '&:hover': {bgcolor: '#fee2e2', color: '#ef4444'} }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Box sx={{ flex: 1, width: '100%', position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
                    
                    {isChartLoading && (
                      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.8)', zIndex: 5, borderRadius: '10px' }}>
                        <CircularProgress size={35} sx={{ color: '#8b5cf6' }} />
                        <Typography sx={{ ml: 2, color: '#475569', fontWeight: 'bold' }}>Retrieving data...</Typography>
                      </Box>
                    )}

                    {!isChartLoading && isHistoricalMode && historicalChartData.length === 0 && (
                      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 4 }}>
                        <Typography sx={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: '500' }}>No telemetry data found for this date.</Typography>
                      </Box>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={isHistoricalMode ? historicalChartData : realtimeChartData}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={{stroke: '#e2e8f0'}} dy={10} />
                        <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} dx={-10} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', fontWeight: 'bold' }} />
                        {device.tags.map((tag, index) => {
                           if (!tag.script || !tag.script.trim() || !tag.record) return null; 
                           return (
                             <Line 
                               key={index} type="monotone" 
                               dataKey={tag.label || `Tag ${index + 1}`} 
                               stroke={CHART_COLORS[index % CHART_COLORS.length]} 
                               strokeWidth={3} dot={isHistoricalMode ? {r: 3, strokeWidth: 1} : false} 
                               activeDot={{r: 6, strokeWidth: 0}}
                               isAnimationActive={isHistoricalMode}  
                             />
                           )
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              )}

              {/* --- 3. กล่อง Datetime --- */}
              {device.showDatetime && (
                <Box
                  onMouseDown={(e) => handleMouseDown(e, 'datetime')}
                  sx={{
                    position: 'absolute',
                    left: device.datetimeX || 500, top: device.datetimeY || 50,
                    width: 300, bgcolor: '#ffffff',
                    border: draggingIdx === 'datetime' ? '2px solid #ec4899' : '1px solid #e2e8f0',
                    boxShadow: draggingIdx === 'datetime' ? '0 10px 25px rgba(236,72,153,0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    borderRadius: '16px', p: 2.5,
                    display: 'flex', flexDirection: 'column',
                    cursor: draggingIdx === 'datetime' ? 'grabbing' : 'grab',
                    zIndex: draggingIdx === 'datetime' ? 10 : 3
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }} onMouseDown={e => e.stopPropagation()}>
                     <Typography variant="subtitle2" fontWeight="800" sx={{ color: '#1e293b', display: 'flex', alignItems: 'center', gap: 1 }}>
                       <DateRangeIcon sx={{ color: '#ec4899' }} /> 
                       Time Machine
                     </Typography>
                     <IconButton size="small" onClick={() => setDevice(prev => ({ ...prev, showDatetime: false }))} sx={{ bgcolor: '#f1f5f9' }}>
                       <CloseIcon fontSize="small" />
                     </IconButton>
                  </Box>
                  
                  <Box onMouseDown={e => e.stopPropagation()}>
                     <TextField
                       type="date" size="small" fullWidth value={selectedDate}
                       onChange={(e) => setSelectedDate(e.target.value)}
                       inputProps={{ max: today }} 
                       sx={{ 
                         '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#f8fafc' },
                         '& input': { fontWeight: 'bold', color: '#334155' }
                       }}
                     />
                     <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#64748b', textAlign: 'center' }}>
                       Select date to load historical charts.
                     </Typography>
                  </Box>
                </Box>
              )}

            </Box>

            {/* --- แถบเครื่องมือ (Tools) - ย้ายมาด้านซ้าย และเปลี่ยนดีไซน์ --- */}
            <Box sx={{ width: 260, bgcolor: '#ffffff', borderRight: '1px solid #e2e8f0', p: 0, overflowY: 'auto', zIndex: 5, boxShadow: '4px 0 15px rgba(0,0,0,0.02)' }}>
               <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9' }}>
                 <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#0f172a', letterSpacing: 0.5 }}>WIDGETS</Typography>
                 <Typography variant="caption" color="#94a3b8">Drag & Drop on canvas</Typography>
               </Box>
               
               <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  
                  {/* ปุ่ม Chart */}
                  <Box 
                    onClick={() => setDevice(prev => ({ ...prev, showChart: true }))} 
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', p: 1.5, borderRadius: '12px', border: device.showChart ? '1px solid #c4b5fd' : '1px solid transparent', bgcolor: device.showChart ? '#f5f3ff' : 'transparent', '&:hover': { bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }, transition: 'all 0.2s' }}
                  >
                    <Box sx={{ p: 1, bgcolor: '#ede9fe', borderRadius: '8px', display: 'flex' }}><InsertChartOutlinedIcon sx={{ color: '#8b5cf6' }} /></Box>
                    <Typography variant="body2" fontWeight={device.showChart ? '800' : '600'} sx={{ color: device.showChart ? '#6d28d9' : '#475569' }}>Telemetry Chart</Typography>
                  </Box>

                  {/* ปุ่ม Datetime */}
                  <Box 
                    onClick={() => setDevice(prev => ({ ...prev, showDatetime: true }))} 
                    sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', p: 1.5, borderRadius: '12px', border: device.showDatetime ? '1px solid #f9a8d4' : '1px solid transparent', bgcolor: device.showDatetime ? '#fdf2f8' : 'transparent', '&:hover': { bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }, transition: 'all 0.2s' }}
                  >
                    <Box sx={{ p: 1, bgcolor: '#fce7f3', borderRadius: '8px', display: 'flex' }}><DateRangeIcon sx={{ color: '#ec4899' }} /></Box>
                    <Typography variant="body2" fontWeight={device.showDatetime ? '800' : '600'} sx={{ color: device.showDatetime ? '#be185d' : '#475569' }}>Time Machine</Typography>
                  </Box>

                  {/* ซ่อนเครื่องมือที่ยังไม่ได้ใช้เพื่อความสวยงาม
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', p: 1.5, borderRadius: '12px', '&:hover': { bgcolor: '#f8fafc', border: '1px solid #e2e8f0' } }}>
                    <Box sx={{ p: 1, bgcolor: '#dcfce7', borderRadius: '8px', display: 'flex' }}><SpeedIcon sx={{ color: '#10b981' }} /></Box>
                    <Typography variant="body2" fontWeight="600" sx={{ color: '#475569' }}>Gauge Meter</Typography>
                  </Box>
                  */}

               </Box>
            </Box>

          </Box>
        )}

      </Box>
    </Page>
  )
}

export default DevicePage