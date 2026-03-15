const cron = require('node-cron');
const supabase = require('./supabase');
const { sendMessage } = require('./whatsapp');

function scheduledJobs(io) {

  // Follow-up due alerts every 15 min
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date().toISOString();
    const { data } = await supabase.from('leads').select('id, name, phone, follow_up_at')
      .eq('follow_up_done', false).lte('follow_up_at', now).not('follow_up_at', 'is', null);
    for (const lead of (data || [])) {
      io.emit('followup:due', lead);
      await supabase.from('notifications').insert({
        title: 'Follow-up Due', message: `Follow up with ${lead.name || lead.phone}`, type: 'followup'
      });
    }
  });

  // Scheduled broadcasts every 5 min
  cron.schedule('*/5 * * * *', async () => {
    const now = new Date().toISOString();
    const { data: scheduled } = await supabase.from('broadcasts')
      .select('*').eq('status', 'scheduled').lte('scheduled_at', now);
    for (const broadcast of (scheduled || [])) {
      try {
        const recipients = typeof broadcast.recipients === 'string'
          ? JSON.parse(broadcast.recipients) : broadcast.recipients || [];
        await supabase.from('broadcasts').update({ status: 'sending' }).eq('id', broadcast.id);
        let sent = 0, failed = 0;
        for (const r of recipients) {
          try {
            await sendMessage(r.phone, broadcast.message); sent++;
            const { data: lead } = await supabase.from('leads').select('id').eq('phone', r.phone).single();
            if (lead) await supabase.from('messages').insert({ lead_id: lead.id, phone: r.phone, content: broadcast.message, direction: 'outgoing', is_read: true });
            await new Promise(r => setTimeout(r, 1500));
            io.emit('broadcast:progress', { id: broadcast.id, sent, failed, total: recipients.length });
          } catch { failed++; }
        }
        await supabase.from('broadcasts').update({ status: 'sent', sent_count: sent, failed_count: failed, sent_at: new Date().toISOString() }).eq('id', broadcast.id);
      } catch (e) {
        await supabase.from('broadcasts').update({ status: 'failed' }).eq('id', broadcast.id);
      }
    }
  });

  // Auto follow-up rules daily at 10am
  cron.schedule('0 10 * * *', async () => {
    const { data: rules } = await supabase.from('followup_rules').select('*').eq('is_active', true);
    for (const rule of (rules || [])) {
      try {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - rule.trigger_days);
        let query = supabase.from('leads').select('id, name, phone').lte('last_message_at', cutoff.toISOString()).not('phone', 'like', '%@%');
        if (rule.filter_stage) {
          const { data: stage } = await supabase.from('lead_stages').select('id').eq('name', rule.filter_stage).single();
          if (stage) query = query.eq('stage_id', stage.id);
        }
        const { data: leads } = await query;
        for (const lead of (leads || [])) {
          try {
            await sendMessage(lead.phone, rule.message);
            const { data: l } = await supabase.from('leads').select('id').eq('phone', lead.phone).single();
            if (l) await supabase.from('messages').insert({ lead_id: l.id, phone: lead.phone, content: rule.message, direction: 'outgoing', is_read: true });
            await new Promise(r => setTimeout(r, 1500));
          } catch {}
        }
        await supabase.from('followup_rules').update({ last_run: new Date().toISOString() }).eq('id', rule.id);
      } catch (e) { console.error('Follow-up rule error:', e.message); }
    }
  });

  // PURCHASE FOLLOW-UP — check daily at 9am
  cron.schedule('0 9 * * *', async () => {
    const today = new Date();
    const { data: purchases } = await supabase.from('purchases').select('*, lead:leads(name, phone)').select('*');

    for (const p of (purchases || [])) {
      if (!p.phone) continue;
      const purchaseDate = new Date(p.purchase_date);
      const daysDiff = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));

      // Day 10 follow-up
      if (daysDiff >= 10 && !p.followup_day_10_sent) {
        const msg = `નમસ્તે! 🌿 ${p.product_name} શરૂ કર્યાના 10 દિવસ થઈ ગયા. આ દવાનો અનુભવ કેવો રહ્યો? કોઈ સુધારો અનુભવ્યો? 😊\n\nવધુ માહિતી માટે: 9023935773`;
        try {
          await sendMessage(p.phone, msg);
          const { data: lead } = await supabase.from('leads').select('id').eq('phone', p.phone).single();
          if (lead) await supabase.from('messages').insert({ lead_id: lead.id, phone: p.phone, content: msg, direction: 'outgoing', is_read: true });
          await supabase.from('purchases').update({ followup_day_10_sent: true }).eq('id', p.id);
          console.log(`✅ Day 10 follow-up sent to ${p.phone} for ${p.product_name}`);
        } catch (e) { console.error('Day 10 follow-up error:', e.message); }
      }

      // Day 45 follow-up (reorder reminder)
      if (daysDiff >= 45 && !p.followup_day_45_sent) {
        const msg = `નમસ્તે! 🌿 ${p.product_name} નો 45 દિવસ થઈ ગઈ. સ્વાસ્થ્ય માટે સંપૂર્ણ ${p.course_days || 60} દિવસ નો કોર્સ પૂર્ણ કરવો ખૂબ જ જરૂરી છે.\n\nઆગળ ની ડોઝ ઓર્ડર કરવા WhatsApp કરો: 9023935773 🙏`;
        try {
          await sendMessage(p.phone, msg);
          const { data: lead } = await supabase.from('leads').select('id').eq('phone', p.phone).single();
          if (lead) await supabase.from('messages').insert({ lead_id: lead.id, phone: p.phone, content: msg, direction: 'outgoing', is_read: true });
          await supabase.from('purchases').update({ followup_day_45_sent: true }).eq('id', p.id);
          console.log(`✅ Day 45 reorder reminder sent to ${p.phone}`);
        } catch (e) { console.error('Day 45 follow-up error:', e.message); }
      }

      // Course complete follow-up
      if (daysDiff >= (p.course_days || 60) && !p.followup_complete_sent) {
        const msg = `અભિનંદન! 🎉 ${p.product_name} નો ${p.course_days || 60} દિવસ નો સંપૂર્ણ કોર્સ પૂર્ણ થયો!\n\nઆપ કેવું અનુભવ છો? સ્વાસ્થ્ય સારું છે ને? 😊\n\nContinue અથવા નવી સ્વાસ્થ્ય સમસ્યા માટે: 9023935773`;
        try {
          await sendMessage(p.phone, msg);
          const { data: lead } = await supabase.from('leads').select('id').eq('phone', p.phone).single();
          if (lead) await supabase.from('messages').insert({ lead_id: lead.id, phone: p.phone, content: msg, direction: 'outgoing', is_read: true });
          await supabase.from('purchases').update({ followup_complete_sent: true }).eq('id', p.id);
        } catch (e) { console.error('Course complete follow-up error:', e.message); }
      }
    }

    // Daily summary
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString());
    io.emit('report:daily', { newLeads: count, date: new Date().toISOString() });
  });
}

module.exports = { scheduledJobs };
