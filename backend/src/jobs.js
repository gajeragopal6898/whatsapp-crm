const cron = require('node-cron');
const supabase = require('./supabase');
const { sendMessage } = require('./whatsapp');

function scheduledJobs(io) {

  // Check follow-up DUE alerts every 15 min
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date().toISOString();
    const { data } = await supabase.from('leads')
      .select('id, name, phone, follow_up_at')
      .eq('follow_up_done', false)
      .lte('follow_up_at', now)
      .not('follow_up_at', 'is', null);

    for (const lead of (data || [])) {
      io.emit('followup:due', lead);
      await supabase.from('notifications').insert({
        title: 'Follow-up Due',
        message: `Follow up with ${lead.name || lead.phone}`,
        type: 'followup'
      });
    }
  });

  // Run scheduled broadcasts every 5 min
  cron.schedule('*/5 * * * *', async () => {
    const now = new Date().toISOString();
    const { data: scheduled } = await supabase.from('broadcasts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    for (const broadcast of (scheduled || [])) {
      try {
        const recipients = typeof broadcast.recipients === 'string'
          ? JSON.parse(broadcast.recipients) : broadcast.recipients || [];

        await supabase.from('broadcasts').update({ status: 'sending' }).eq('id', broadcast.id);

        let sent = 0, failed = 0;
        for (const r of recipients) {
          try {
            await sendMessage(r.phone, broadcast.message);
            sent++;
            const { data: lead } = await supabase.from('leads').select('id').eq('phone', r.phone).single();
            if (lead) {
              await supabase.from('messages').insert({
                lead_id: lead.id, phone: r.phone,
                content: broadcast.message, direction: 'outgoing', is_read: true
              });
            }
            await new Promise(r => setTimeout(r, 1500));
            io.emit('broadcast:progress', { id: broadcast.id, sent, failed, total: recipients.length });
          } catch { failed++; }
        }

        await supabase.from('broadcasts').update({
          status: 'sent', sent_count: sent,
          failed_count: failed, sent_at: new Date().toISOString()
        }).eq('id', broadcast.id);

        console.log(`✅ Scheduled broadcast "${broadcast.name}" sent: ${sent}/${recipients.length}`);
      } catch (e) {
        console.error('Scheduled broadcast error:', e.message);
        await supabase.from('broadcasts').update({ status: 'failed' }).eq('id', broadcast.id);
      }
    }
  });

  // Run auto follow-up rules daily at 10am
  cron.schedule('0 10 * * *', async () => {
    const { data: rules } = await supabase.from('followup_rules')
      .select('*').eq('is_active', true);

    for (const rule of (rules || [])) {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - rule.trigger_days);

        let query = supabase.from('leads')
          .select('id, name, phone, last_message_at')
          .lte('last_message_at', cutoff.toISOString())
          .not('phone', 'like', '%@%');

        if (rule.filter_stage) {
          const { data: stage } = await supabase.from('lead_stages').select('id').eq('name', rule.filter_stage).single();
          if (stage) query = query.eq('stage_id', stage.id);
        }

        const { data: leads } = await query;
        let sent = 0;

        for (const lead of (leads || [])) {
          try {
            await sendMessage(lead.phone, rule.message);
            sent++;
            const { data: l } = await supabase.from('leads').select('id').eq('phone', lead.phone).single();
            if (l) {
              await supabase.from('messages').insert({
                lead_id: l.id, phone: lead.phone,
                content: rule.message, direction: 'outgoing', is_read: true
              });
            }
            await new Promise(r => setTimeout(r, 1500));
          } catch {}
        }

        await supabase.from('followup_rules').update({ last_run: new Date().toISOString() }).eq('id', rule.id);
        console.log(`✅ Follow-up rule "${rule.name}" sent to ${sent} leads`);
      } catch (e) {
        console.error('Follow-up rule error:', e.message);
      }
    }
  });

  // Daily summary at 9am
  cron.schedule('0 9 * * *', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { count } = await supabase.from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    io.emit('report:daily', { newLeads: count, date: new Date().toISOString() });
  });
}

module.exports = { scheduledJobs };
