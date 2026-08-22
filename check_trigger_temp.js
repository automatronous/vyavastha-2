import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env from workspace root
const envPath = './.env';
const envContent = fs.readFileSync(envPath, 'utf8');

const envConfig = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    envConfig[key] = value;
  }
});

const supabase = createClient(
  envConfig.VITE_SUPABASE_URL,
  envConfig.VITE_SUPABASE_ANON_KEY
);

async function checkTrigger() {
  try {
    const email = `test_manager_${Date.now()}@example.com`;
    const password = 'Password123!';

    console.log('Signing up a test user:', email);
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      console.error('Sign up error:', signUpError);
      return;
    }

    const user = authData.user;
    console.log('Signed up user:', user.id);

    // Sign in to establish session
    console.log('Signing in...');
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInErr) {
      console.error('Sign in error:', signInErr);
      return;
    }
    console.log('Signed in successfully.');

    console.log('Creating test project...');
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .insert({
        name: 'Test Trigger Project ' + Date.now(),
        location: 'Test Location',
        admin_id: user.id
      })
      .select()
      .single();

    if (projErr) {
      console.error('Error creating project:', projErr);
      return;
    }
    console.log('Created project:', project);

    console.log('Creating test product...');
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({
        name: 'Test Trigger Product ' + Date.now(),
        project_id: project.id,
        category: 'General'
      })
      .select()
      .single();

    if (prodErr) {
      console.error('Error creating product:', prodErr);
      // Clean up project
      await supabase.from('projects').delete().eq('id', project.id);
      return;
    }
    console.log('Created product:', product);

    console.log('Inserting initial stock of 10...');
    const { data: stock, error: stockErr } = await supabase
      .from('stock')
      .insert({
        product_id: product.id,
        project_id: project.id,
        current_qty: 10,
        threshold: 10,
        last_updated: new Date().toISOString()
      })
      .select()
      .single();

    if (stockErr) {
      console.error('Error creating stock:', stockErr);
      // Clean up
      await supabase.from('products').delete().eq('id', product.id);
      await supabase.from('projects').delete().eq('id', project.id);
      return;
    }
    console.log('Created stock row:', stock);

    console.log('Inserting transaction of type inward, qty 5...');
    const { data: txn, error: txnErr } = await supabase
      .from('transactions')
      .insert({
        product_id: product.id,
        project_id: project.id,
        type: 'inward',
        qty: 5,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (txnErr) {
      console.error('Error inserting transaction:', txnErr);
      // Clean up
      await supabase.from('stock').delete().eq('product_id', product.id);
      await supabase.from('products').delete().eq('id', product.id);
      await supabase.from('projects').delete().eq('id', project.id);
      return;
    }
    console.log('Inserted transaction:', txn);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Get stock after transaction
    const { data: stockAfter } = await supabase
      .from('stock')
      .select('current_qty')
      .eq('product_id', product.id)
      .single();

    console.log('Stock current_qty before transaction:', 10);
    console.log('Stock current_qty after transaction:', stockAfter?.current_qty);
    console.log('Difference:', (stockAfter?.current_qty || 0) - 10);

    if ((stockAfter?.current_qty || 0) - 10 === 5) {
      console.log('SUCCESS: Database trigger automatically updated stock!');
    } else {
      console.log('NO TRIGGER: Stock was not updated automatically.');
    }

    // Clean up all
    console.log('Cleaning up...');
    await supabase.from('transactions').delete().eq('id', txn.id);
    await supabase.from('stock').delete().eq('product_id', product.id);
    await supabase.from('products').delete().eq('id', product.id);
    await supabase.from('projects').delete().eq('id', project.id);
    console.log('Clean up complete.');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkTrigger();
