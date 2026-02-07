import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wxclbfnothhqgajfbcwe.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4Y2xiZm5vdGhocWdhamZiY3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjU5MTgsImV4cCI6MjA4NTkwMTkxOH0.MniuoH43VD0FQAIdTdDstrI8mQogWyqGjTZFOvJRdmo'

const supabase = createClient(supabaseUrl, supabaseKey)

async function exploreDatabase() {
  console.log('🔍 Exploration de la base de données Supabase...\n')

  // 1. Liste des tables
  console.log('📋 Liste des tables :')
  const { data: tables, error: tablesError } = await supabase
    .rpc('get_tables')
  
  if (tablesError) {
    console.log('   Impossible de lister les tables via RPC, essai direct...')
  } else {
    console.log('   Tables trouvées:', tables)
  }

  // 2. Vérifier la table hotels
  console.log('\n🏨 Table hotels :')
  const { data: hotels, error: hotelsError } = await supabase
    .from('hotels')
    .select('*')
    .limit(5)
  
  if (hotelsError) {
    console.log('   ❌ Erreur:', hotelsError.message)
  } else {
    console.log('   ✅', hotels.length, 'hôtels trouvés')
    if (hotels.length > 0) {
      console.log('   Premier hôtel:', hotels[0])
    }
  }

  // 3. Vérifier booking_apercu
  console.log('\n📊 Table booking_apercu :')
  const { data: apercu, error: apercuError } = await supabase
    .from('booking_apercu')
    .select('*')
    .limit(3)
  
  if (apercuError) {
    console.log('   ❌ Erreur:', apercuError.message)
  } else {
    console.log('   ✅', apercu.length, 'enregistrements')
    if (apercu.length > 0) {
      console.log('   Colonnes:', Object.keys(apercu[0]).join(', '))
    }
  }

  // 4. Vérifier booking_export
  console.log('\n📦 Table booking_export :')
  const { data: exports, error: exportsError } = await supabase
    .from('booking_export')
    .select('*')
    .limit(3)
  
  if (exportsError) {
    console.log('   ❌ Erreur:', exportsError.message)
  } else {
    console.log('   ✅', exports.length, 'réservations')
    if (exports.length > 0) {
      console.log('   Colonnes principales:', Object.keys(exports[0]).slice(0, 10).join(', '), '...')
    }
  }

  // 5. Vérifier disponibilites
  console.log('\n🛏️  Table disponibilites :')
  const { data: dispo, error: dispoError } = await supabase
    .from('disponibilites')
    .select('*')
    .limit(3)
  
  if (dispoError) {
    console.log('   ❌ Erreur:', dispoError.message)
  } else {
    console.log('   ✅', dispo.length, 'disponibilités')
    if (dispo.length > 0) {
      console.log('   Colonnes:', Object.keys(dispo[0]).join(', '))
    }
  }

  // 6. Vérifier events_calendar
  console.log('\n📅 Table events_calendar :')
  const { data: events, error: eventsError } = await supabase
    .from('events_calendar')
    .select('*')
    .limit(3)
  
  if (eventsError) {
    console.log('   ❌ Erreur:', eventsError.message)
  } else {
    console.log('   ✅', events.length, 'événements')
    if (events.length > 0) {
      console.log('   Colonnes:', Object.keys(events[0]).join(', '))
    }
  }

  // 7. Vérifier hotels_concurrents
  console.log('\n🏢 Table hotels_concurrents :')
  const { data: concurrents, error: concurrentsError } = await supabase
    .from('hotels_concurrents')
    .select('*')
    .limit(5)
  
  if (concurrentsError) {
    console.log('   ❌ Erreur:', concurrentsError.message)
  } else {
    console.log('   ✅', concurrents.length, 'concurrents')
    if (concurrents.length > 0) {
      console.log('   Exemple:', concurrents[0])
    }
  }

  console.log('\n✨ Exploration terminée!')
}

exploreDatabase().catch(console.error)
