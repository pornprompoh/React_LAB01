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

import TextFieldsIcon from '@mui/icons-material/TextFields'
import InsertChartIcon from '@mui/icons-material/InsertChart'
import SpeedIcon from '@mui/icons-material/Speed'
import MapIcon from '@mui/icons-material/Map'

const jsexe = async (code) => {
  try {
    const func = new Function(`return (${code})`)
    const result = func()
    if (result instanceof Promise) {
      return await result
    }
    return result
  } catch (error) {
    throw error
  }
}

const DevicePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const isCreateMode = id === 'create'
  const collectionName = 'Device'

  const [loading, setLoading] = useState(!isCreateMode)
  const [saving, setSaving] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState(false) 
  
  const [activeTab, setActiveTab] = useState('devices') 
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 })
  
  const [device, setDevice] = useState({
    _id: '', code: '0', connection: 'Virtual', model: 'Virtual', ipAddr: '',
    name: 'Virtual', remark: 'Virtual Device', apiCode: '',
    lineChannel: '', lineId: '', emailFrom: '', emailPwd: '', emailTo: '',
    status: 'Active', revision: 1, tags: [] 
  })

  const [originalDevice, setOriginalDevice] = useState(null)
  const [tagResults, setTagResults] = useState({})
  const [tagErrors, setTagErrors] = useState({})

  const tagsRef = useRef([])

  function getAuth() {
    let auth = null
    const item = localStorage.getItem('base-shell:auth')
    if (item) auth = JSON.parse(item)
    return auth
  }

  useEffect(() => {
    tagsRef.current = device.tags
  }, [device.tags])

  useEffect(() => {
    let isMounted = true;
    const intervalId = setInterval(async () => {
      const currentTags = tagsRef.current;
      if (!currentTags || currentTags.length === 0) return;

      const resultsBatch = {};
      const errorsBatch = {};

      await Promise.all(currentTags.map(async (tag, index) => {
        if (tag.script && tag.script.trim()) {
          try {
            const output = await jsexe(tag.script);
            resultsBatch[index] = output;
            errorsBatch[index] = null;
          } catch (err) {
            errorsBatch[index] = err.message;
          }
        }
      }));

      if (isMounted) {
        setTagResults(prev => ({ ...prev, ...resultsBatch }));
        setTagErrors(prev => ({ ...prev, ...errorsBatch }));
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (isCreateMode) {
      setDevice(prev => ({ ...prev, tags: [] }))
      return;
    }

    async function fetchData() {
      try {
        const auth = getAuth()
        if (!auth) return
        const resp = await fetch('/api/preferences/readDocument', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
          body: JSON.stringify({ collection: collectionName, query: { _id: id } })
        })
        const json = await resp.json()
        
        if (json && json.length > 0) {
          let loadedDevice = json[0];
          if (!loadedDevice.tags) loadedDevice.tags = [];
          
          setDevice(loadedDevice)
          setOriginalDevice(JSON.parse(JSON.stringify(loadedDevice)))
        } else {
          alert('Device not found')
          navigate('/dashboard')
        }
      } catch (error) {
        console.error('Fetch error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, navigate, isCreateMode])

  const handleChange = (e) => {
    const { name, value } = e.target
    setDevice(prev => ({ ...prev, [name]: value }))
  }

  const handleTagChange = (index, field, value) => {
    const newTags = [...device.tags]
    newTags[index][field] = value
    setDevice(prev => ({ ...prev, tags: newTags }))
  }

  const runTagScript = async (index, e) => {
    if (e) e.stopPropagation()
    setTagErrors(prev => ({ ...prev, [index]: null }))
    setTagResults(prev => ({ ...prev, [index]: null }))
    try {
      const code = device.tags[index].script
      if (!code || !code.trim()) return
      const output = await jsexe(code)
      setTagResults(prev => ({ ...prev, [index]: output }))
    } catch (err) {
      setTagErrors(prev => ({ ...prev, [index]: err.message }))
    }
  }

  // --- [ปรับปรุง] แยกระบบ SAVE ตามหน้า (Tabs) ---
  const handleSave = async () => {
    try {
      if (!device._id || !device.name) { alert('Please fill ID and Name'); return }

      // เช็คว่ามีการเปลี่ยนแปลงข้อมูลหรือไม่ (เอาไว้กันเหนียว)
      const currentStr = JSON.stringify(device);
      const originalStr = originalDevice ? JSON.stringify(originalDevice) : null;
      const isDataChanged = !originalDevice || currentStr !== originalStr;

      let dataToSave = { ...device };

      // ===============================================
      // กรณี 1: กด Save จากหน้าต่าง DASHBOARD (เซฟแค่พิกัด)
      // ===============================================
      if (activeTab === 'dashboard') {
        if (!isDataChanged) {
          alert('No layout changes to save.'); // ถ้าไม่ได้ขยับกล่องเลย ไม่ต้องส่งไปเซฟ
          return;
        }
        dataToSave.revision = (Number(dataToSave.revision) || 1) + 1;
        // ไม่มีการเพิ่ม tags ใหม่ที่นี่ !
      } 
      // ===============================================
      // กรณี 2: กด Save จากหน้าต่าง DEVICES (บันทึกข้อมูล + งอก Tag)
      // ===============================================
      else {
        if (!isDataChanged && !isCreateMode) {
          const confirmNewTag = window.confirm('ข้อมูลไม่มีการเปลี่ยนแปลง\nต้องการสร้าง Tag ใหม่เพิ่ม 1 อัน ใช่หรือไม่?');
          if (!confirmNewTag) return;
        }

        dataToSave.revision = isCreateMode ? 1 : (Number(dataToSave.revision) || 1) + 1; 

        // งอก Tag ใหม่ 1 อัน
        const nextTagNumber = dataToSave.tags.length + 1;
        const autoNewTag = { 
          label: `tag${nextTagNumber}`, script: '', updateInterval: '1min', 
          record: true, sync: true, api: false, line: false, email: false, 
          alarm: 'Off', spLow: '25', spHigh: '35', critical: 'Low', title: '', alert: '', description: '',
          x: 100 + (nextTagNumber * 20), y: 100 + (nextTagNumber * 20)  
        };
        dataToSave.tags = [...dataToSave.tags, autoNewTag];
      }

      // --- ส่วนยิง API ไปบันทึกลง Database ---
      setSaving(true)
      const auth = getAuth()
      const url = isCreateMode ? '/api/preferences/createDocument' : '/api/preferences/updateDocument'
      
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
        body: JSON.stringify({ collection: collectionName, data: dataToSave })
      })
      
      const json = await resp.json()
      if (json.error) throw new Error(json.error)

      setDevice(dataToSave)
      setOriginalDevice(JSON.parse(JSON.stringify(dataToSave))) // อัปเดตภาพจำต้นฉบับ

      // การแจ้งเตือนแยกตามหน้า
      if (activeTab === 'dashboard') {
        alert('Dashboard layout saved successfully!');
      } else {
        if (isCreateMode) {
          navigate(`/dashboard/${dataToSave._id}`, { replace: true })
          alert('Device created! You can continue editing.')
        } else {
          alert('Saved Device & Generated a new Tag successfully!')
        }
      }

    } catch (error) {
      alert('Error saving data: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if(!window.confirm(`Delete ${device.name}?`)) return;
    try {
        setSaving(true)
        const auth = getAuth()
        await fetch('/api/preferences/deleteDocument', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
        body: JSON.stringify({ collection: collectionName, data: dataToSave })
      });
      const json = await resp.json();
      if (json.error) throw new Error(json.error);

      setDevice(dataToSave);
      setOriginalDevice(JSON.parse(JSON.stringify(dataToSave))); 
      
      setTagResults({}); setTagErrors({});
      alert('Tag deleted and reordered successfully!');
    } catch (error) {
      alert('Error deleting tag: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  const handleMouseDown = (e, index) => {
    e.preventDefault();
    setDraggingIdx(index);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (draggingIdx === null) return;
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    setDragStartPos({ x: e.clientX, y: e.clientY });

    const newTags = [...device.tags];
    newTags[draggingIdx].x = (newTags[draggingIdx].x || 50) + dx;
    newTags[draggingIdx].y = (newTags[draggingIdx].y || 50) + dy;
    setDevice(prev => ({ ...prev, tags: newTags }));
  };

  const handleMouseUp = () => {
    setDraggingIdx(null);
  };

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
        
        <Box sx={{ px: 4, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconButton onClick={() => navigate('/dashboard')} size="small" sx={{ mr: -2 }}><ArrowBackIcon /></IconButton>
            
            <Typography 
              onClick={() => setActiveTab('devices')} 
              variant="subtitle1" 
              sx={{ cursor: 'pointer', fontWeight: 'bold', color: activeTab === 'devices' ? '#1976d2' : '#999', borderBottom: activeTab === 'devices' ? '3px solid #1976d2' : '3px solid transparent', pb: 0.5, transition: '0.2s' }}
            >
              DEVICES
            </Typography>

            <Typography 
              onClick={() => setActiveTab('dashboard')} 
              variant="subtitle1" 
              sx={{ cursor: 'pointer', fontWeight: 'bold', color: activeTab === 'dashboard' ? '#1976d2' : '#999', borderBottom: activeTab === 'dashboard' ? '3px solid #1976d2' : '3px solid transparent', pb: 0.5, transition: '0.2s' }}
            >
              DASHBOARD
            </Typography>

          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!isCreateMode && <Button color="error" onClick={handleDelete} size="small">DELETE</Button>}
            <Button onClick={handleSave} disabled={saving} size="small" variant="contained" sx={{ fontWeight: 'bold' }}>
              {saving ? 'SAVING...' : 'SAVE'}
            </Button>
          </Box>
        </Box>

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
              <Accordion 
                key={index} 
                expanded={expandedPanel === `panel${index}`} 
                onChange={(e, isExpanded) => setExpandedPanel(isExpanded ? `panel${index}` : false)}
                disableGutters
                elevation={1}
                sx={{ border: '1px solid #e0e0e0', mb: 1, borderRadius: '4px !important', '&:before': { display: 'none' } }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, bgcolor: expandedPanel === `panel${index}` ? '#f5f9ff' : '#fff' }}>
                  <Grid container alignItems="center">
                    <Grid item xs={3} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                      <Typography variant="body1" fontWeight="bold" sx={{ color: '#333' }}>{tag.label || `Tag ${index+1}`}</Typography>
                    </Grid>
                    <Grid item xs={4} sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                        {tagResults[index] !== null && tagResults[index] !== undefined ? String(tagResults[index]) : ''}
                      </Typography>
                    </Grid>
                    <Grid item xs={5} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      <FormControlLabel onClick={(e)=>e.stopPropagation()} control={<Checkbox size="small" checked={tag.record} onChange={(e) => handleTagChange(index, 'record', e.target.checked)} color="success" />} label={<Typography variant="caption">Record</Typography>} />
                      <FormControlLabel onClick={(e)=>e.stopPropagation()} control={<Checkbox size="small" checked={tag.sync} onChange={(e) => handleTagChange(index, 'sync', e.target.checked)} color="success" />} label={<Typography variant="caption">Sync</Typography>} />
                      <FormControlLabel onClick={(e)=>e.stopPropagation()} control={<Checkbox size="small" checked={tag.api} onChange={(e) => handleTagChange(index, 'api', e.target.checked)} color="default" />} label={<Typography variant="caption">API</Typography>} />
                    </Grid>
                  </Grid>
                </AccordionSummary>

                <AccordionDetails sx={{ p: 3, borderTop: '1px solid #eee' }}>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                     <Button color="error" variant="outlined" size="small" onClick={() => deleteTag(index)}>Delete Tag</Button>
                  </Box>

                  <Grid container spacing={3} alignItems="flex-start" sx={{ mb: 2 }}>
                    <Grid item xs={3}><TextField {...inputProps} label="Label" value={tag.label} onChange={(e) => handleTagChange(index, 'label', e.target.value)} /></Grid>
                    <Grid item xs={3}>
                      <TextField select {...inputProps} label="Update Interval" value={tag.updateInterval} onChange={(e) => handleTagChange(index, 'updateInterval', e.target.value)}>
                        <MenuItem value="1min">1 min</MenuItem><MenuItem value="daily">Daily</MenuItem><MenuItem value="week">Weekly</MenuItem><MenuItem value="month">Monthly</MenuItem><MenuItem value="year">Yearly</MenuItem>
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
                  <TextField 
                    fullWidth multiline minRows={4} variant="outlined" 
                    value={tag.script} onChange={(e) => handleTagChange(index, 'script', e.target.value)}
                    sx={{ bgcolor: '#f5f5f5', mb: 1, '& input, & textarea': { fontSize: '0.875rem', fontFamily: 'monospace', color: '#333' } }}
                  />
                  <Box sx={{ textAlign: 'right', mb: 2 }}>
                    <Button variant="contained" color="secondary" size="small" startIcon={<PlayArrowIcon/>} onClick={(e) => runTagScript(index, e)}>TEST SCRIPT</Button>
                  </Box>

                  <Typography variant="subtitle2" sx={{ color: '#555', mb: 1 }}>Console Output (Real-time)</Typography>
                  <Box sx={{ p: 2, bgcolor: '#282c34', color: '#fff', borderRadius: '4px', minHeight: '80px', mb: 4, fontSize: '0.9rem', fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
                    {tagErrors[index] ? <Typography color="error">{tagErrors[index]}</Typography>
                     : tagResults[index] !== null && tagResults[index] !== undefined ? <Typography sx={{ color: '#98c379', fontWeight: 'bold' }}>{String(tagResults[index])}</Typography>
                     : <Typography variant="caption" sx={{ color: '#5c6370' }}>Waiting for execution...</Typography>}
                  </Box>

                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {activeTab === 'dashboard' && (
          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            <Box 
              sx={{ flex: 1, position: 'relative', bgcolor: '#f4f6f8', backgroundImage: 'radial-gradient(#ddd 1px, transparent 0)', backgroundSize: '20px 20px' }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp} 
            >
              {device.tags.map((tag, index) => {
                if(!tag.script || !tag.script.trim()) return null; 

                return (
                  <Box
                    key={index}
                    onMouseDown={(e) => handleMouseDown(e, index)}
                    sx={{
                      position: 'absolute',
                      left: tag.x !== undefined ? tag.x : 50 + (index*20),
                      top: tag.y !== undefined ? tag.y : 50 + (index*20),
                      width: 140, height: 80,
                      bgcolor: '#fff',
                      border: draggingIdx === index ? '2px solid #1976d2' : '1px solid #ccc',
                      boxShadow: draggingIdx === index ? 6 : 1,
                      borderRadius: 1,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: draggingIdx === index ? 'grabbing' : 'grab',
                      userSelect: 'none',
                      transition: draggingIdx === index ? 'none' : 'box-shadow 0.2s',
                      zIndex: draggingIdx === index ? 10 : 1
                    }}
                  >
                    <Typography variant="body1" sx={{ color: '#333', fontWeight: 'bold' }}>
                      {tagResults[index] !== null && tagResults[index] !== undefined ? String(tagResults[index]) : '...'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#888', mt: 0.5 }}>
                      {tag.label || `Tag ${index+1}`}
                    </Typography>
                  </Box>
                )
              })}
            </Box>

            <Box sx={{ width: 250, bgcolor: '#fff', borderLeft: '1px solid #ddd', p: 0, overflowY: 'auto' }}>
               <Box sx={{ p: 2, bgcolor: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
                 <Typography variant="subtitle2" fontWeight="bold">Tools</Typography>
               </Box>
               
               <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' } }}>
                    <TextFieldsIcon sx={{ color: '#f44336' }} /> <Typography variant="body2">Textbox</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' } }}>
                    <InsertChartIcon sx={{ color: '#ff9800' }} /> <Typography variant="body2">Chart</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' } }}>
                    <SpeedIcon sx={{ color: '#9c27b0' }} /> <Typography variant="body2">Gauge</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', '&:hover': { color: '#1976d2' } }}>
                    <MapIcon sx={{ color: '#4caf50' }} /> <Typography variant="body2">Map</Typography>
                  </Box>
                  <Divider />
                  <Typography variant="caption" color="text.secondary">
                    * ลากกล่องบนหน้าจอเพื่อจัดวางตำแหน่งได้เลย
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