const router = require('express').Router();
const bcrypt = require('bcryptjs');
const supabase = require('../supabase');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { data } = await supabase.from('users').select('id, name, email, role, is_active, created_at').order('created_at');
  res.json(data || []);
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, email, password, role } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('users').insert({ name, email, password: hashed, role }).select('id, name, email, role').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.patch('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const updates = { ...req.body };
  if (updates.password) updates.password = await bcrypt.hash(updates.password, 10);
  const { data, error } = await supabase.from('users').update(updates).eq('id', req.params.id).select('id, name, email, role, is_active').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  await supabase.from('users').update({ is_active: false }).eq('id', req.params.id);
  res.json({ success: true });
});

module.exports = router;

// Team performance stats for dashboard
router.get('/team-stats', auth, async (req, res) => {
  try {
    const { data: users } = await supabase.from('users').select('id, name, email, role').eq('is_active', true);
    
    const stats = await Promise.all((users || []).map(async (user) => {
      const [assigned, closed, contacted, today] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id)
          .eq('stage_id', (await supabase.from('lead_stages').select('id').eq('name','Closed').single())?.data?.id || '00000000-0000-0000-0000-000000000000'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id)
          .neq('stage_id', null),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id)
          .gte('created_at', new Date().toISOString().slice(0,10)),
      ]);
      return {
        ...user,
        assigned_leads: assigned.count || 0,
        closed_leads: closed.count || 0,
        active_leads: contacted.count || 0,
        today_leads: today.count || 0,
      };
    }));
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
