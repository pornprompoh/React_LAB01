import React, { useState, useEffect } from 'react'
import Page from '../../containers/Page/Page'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Typography, Grid, Card, CardContent, Divider, CircularProgress, Checkbox, Paper
} from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ComputerIcon from '@mui/icons-material/Computer'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import MemoryIcon from '@mui/icons-material/Memory'

const Dashboard = () => {
  const intl = useIntl()
  const navigate = useNavigate()

  const [devices, setDevices] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([]) 

  function getAuth() {
    let auth = null
    const item = localStorage.getItem('base-shell:auth')
    if (item) auth = JSON.parse(item)
    return auth
  }

  async function fetchDevices() {
    try {
      const auth = getAuth()
      if (!auth) return

      const resp = await fetch('/api/preferences/readDocument', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
        body: JSON.stringify({
          collection: 'Device',
          query: {},
        })
      })
      
      const json = await resp.json()
      if (Array.isArray(json)) {
        setDevices(json)
        setSelected([]) 
      } else {
        setDevices([])
      }
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const newSelecteds = devices.map((n) => n._id)
      setSelected(newSelecteds)
      return
    }
    setSelected([])
  }

  const handleSelectOne = (event, id) => {
    event.stopPropagation() 
    const selectedIndex = selected.indexOf(id)
    let newSelected = []

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id)
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1))
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1))
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1),
      )
    }
    setSelected(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selected.length} devices?`)) return
    const auth = getAuth()
    try {
      for (let id of selected) {
         await fetch('/api/preferences/deleteDocument', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'authorization': auth.token },
            body: JSON.stringify({ collection: 'Device', query: { _id: id } })
         })
      }
      fetchDevices()
      alert('Deleted successfully')
    } catch (error) {
      console.error(error)
      alert('Delete failed')
    }
  }

  return (
    <Page pageTitle={intl.formatMessage({ id: 'dashboard', defaultMessage: 'Device Management' })}>
      <Box sx={{ padding: 4, minHeight: 'calc(100vh - 64px)', bgcolor: '#f1f5f9' }}>

        {/* แถบควบคุมด้านบน (Header Bar) - ดีไซน์ใหม่ */}
        <Paper 
          elevation={0} 
          sx={{ 
            mb: 4, p: 2.5, px: 3, 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            borderRadius: '20px', 
            border: selected.length > 0 ? '1px solid #c4b5fd' : '1px solid #e2e8f0', 
            bgcolor: selected.length > 0 ? '#f5f3ff' : '#ffffff', 
            boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
            transition: 'all 0.3s ease'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Checkbox
              color="primary"
              indeterminate={selected.length > 0 && selected.length < devices.length}
              checked={devices.length > 0 && selected.length === devices.length}
              onChange={handleSelectAll}
              disabled={devices.length === 0} 
              sx={{ color: '#cbd5e1', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#6d28d9' } }}
            />
            <Typography variant="h6" fontWeight="800" sx={{ ml: 1, color: selected.length > 0 ? '#6d28d9' : '#1e293b', letterSpacing: 0.5 }}>
              {selected.length > 0 ? `${selected.length} Devices Selected` : `All Connected Devices (${devices.length})`}
            </Typography>
          </Box>
          
          <Box>
            {selected.length > 0 ? (
              <Button 
                variant="outlined" 
                startIcon={<DeleteOutlineIcon />} 
                onClick={handleDeleteSelected} 
                sx={{ 
                  borderRadius: '12px', textTransform: 'none', fontWeight: 'bold', 
                  color: '#ef4444', borderColor: '#fca5a5', bgcolor: '#fef2f2',
                  '&:hover': { bgcolor: '#fee2e2', borderColor: '#ef4444' }
                }}
              >
                Delete Selected
              </Button>
            ) : (
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<AddCircleOutlineIcon />} 
                onClick={() => navigate('/dashboard/create')} 
                sx={{ 
                  borderRadius: '12px', textTransform: 'none', fontWeight: 'bold', 
                  bgcolor: '#4f46e5', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                  '&:hover': { bgcolor: '#4338ca', transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(79, 70, 229, 0.5)' },
                  transition: 'all 0.2s ease'
                }}
              >
                New Device
              </Button>
            )}
          </Box>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
             <CircularProgress sx={{ color: '#4f46e5' }} />
          </Box>
        ) : (
          <Grid container spacing={4}>
            {devices.map((device) => {
              const isSelected = selected.indexOf(device._id) !== -1;

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={device._id}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%', position: 'relative', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
                      borderRadius: '24px',
                      border: isSelected ? '2px solid #818cf8' : '1px solid #e2e8f0',
                      bgcolor: isSelected ? '#f5f9ff' : '#ffffff',
                      boxShadow: isSelected ? '0 12px 24px rgba(99,102,241,0.15)' : '0 4px 12px rgba(0,0,0,0.03)',
                      '&:hover': { 
                        transform: 'translateY(-6px)', 
                        boxShadow: isSelected ? '0 15px 30px rgba(99,102,241,0.2)' : '0 12px 24px rgba(0,0,0,0.08)',
                        borderColor: isSelected ? '#818cf8' : '#cbd5e1'
                      }
                    }}
                    onClick={() => navigate(`/dashboard/${device._id}`)}
                  >
                    <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
                       <Checkbox 
                         checked={isSelected} 
                         onClick={(e) => handleSelectOne(e, device._id)} 
                         sx={{ color: '#cbd5e1', '&.Mui-checked': { color: '#6d28d9' } }}
                       />
                    </Box>

                    <CardContent sx={{ textAlign: 'center', p: 4, pt: 5, pb: '32px !important' }}>
                      {/* ไอคอนอุปกรณ์ในกล่องมนๆ */}
                      <Box sx={{ 
                        width: 70, height: 70, borderRadius: '20px', 
                        bgcolor: device.status === 'Active' ? '#e0e7ff' : '#f1f5f9', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        margin: '0 auto', mb: 3 
                      }}>
                         <MemoryIcon sx={{ fontSize: 36, color: device.status === 'Active' ? '#4f46e5' : '#94a3b8' }} />
                      </Box>

                      <Typography variant="h6" sx={{ fontWeight: '800', color: '#1e293b', mb: 0.5 }} noWrap>
                        {device.name || 'Unnamed Device'}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 2, fontWeight: '500' }}>
                        Protocol: {device.connection || '-'}
                      </Typography>

                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, alignItems: 'center', mt: 3 }}>
                         {/* ป้าย Revision */}
                         <Box sx={{ px: 2, py: 0.5, borderRadius: '8px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 'bold', fontFamily: 'monospace' }}>
                              REV: {device.revision || 1}
                            </Typography>
                         </Box>

                         {/* ป้าย Status */}
                         <Box sx={{ 
                            px: 2, py: 0.5, borderRadius: '8px', fontWeight: 'bold', 
                            bgcolor: device.status === 'Active' ? '#dcfce7' : '#f1f5f9', 
                            color: device.status === 'Active' ? '#16a34a' : '#64748b' 
                         }}>
                            <Typography variant="caption" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {device.status || 'Unknown'}
                            </Typography>
                         </Box>
                      </Box>

                    </CardContent>
                  </Card>
                </Grid>
              );
            })}

            {/* กล่องกรณีไม่มีข้อมูล (Empty State) */}
            {devices.length === 0 && (
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 8, mt: 2, textAlign: 'center', 
                  border: '2px dashed #cbd5e1', borderRadius: '24px', 
                  bgcolor: '#f8fafc', color: '#64748b' 
                }}>
                  <ComputerIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                  <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ color: '#334155' }}>No devices found</Typography>
                  <Typography variant="body2" sx={{ mb: 4 }}>Get started by creating your first IoT device workspace.</Typography>
                  <Button 
                    variant="contained" 
                    onClick={() => navigate('/dashboard/create')}
                    sx={{ bgcolor: '#4f46e5', borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', px: 4 }}
                  >
                    Create Workspace
                  </Button>
                </Box>
              </Grid>
            )}
          </Grid>
        )}
      </Box>
    </Page>
  )
}

export default Dashboard