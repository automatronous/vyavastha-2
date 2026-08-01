import { useState, useEffect, useContext } from 'react';
import { Users, UserPlus, X, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { ProjectContext } from '../context/ProjectContext';

export default function Settings({ user }) {
  const { projects } = useContext(ProjectContext);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newManager, setNewManager] = useState({
    name: '', email: '', password: '', project_id: ''
  });

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    setLoading(true);

    // Get all project IDs belonging to this admin
    const { data: adminProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('admin_id', user.id);

    const projectIds = adminProjects?.map(p => p.id) || [];

    if (projectIds.length === 0) {
      setManagers([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, project_id, projects(name)')
      .eq('role', 'manager')
      .in('project_id', projectIds);

    if (!error) setManagers(data || []);
    setLoading(false);
  };

  const deactivateManager = async (id) => {
    if (!confirm('Deactivate this manager? They will lose access immediately.')) return;

    const { error } = await supabase
      .from('users')
      .update({ role: 'inactive' })
      .eq('id', id);

    if (error) {
      alert('Failed to deactivate manager.');
      return;
    }
    fetchManagers();
  };

  const handleAddManager = async (e) => {
    e.preventDefault();
    if (!newManager.name.trim() || !newManager.email.trim() || !newManager.password.trim() || !newManager.project_id) {
      alert('Please fill all fields.');
      return;
    }
    if (newManager.password.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Create Supabase Auth account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newManager.email.trim(),
        password: newManager.password
      });

      if (signUpError) throw signUpError;
      if (!signUpData?.user) throw new Error('Account creation failed.');

      // Step 2: Insert into users table
      const { error: insertError } = await supabase.from('users').insert({
        id: signUpData.user.id,
        name: newManager.name.trim(),
        email: newManager.email.trim(),
        role: 'manager',
        project_id: newManager.project_id,
        created_by: user.id
      });

      if (insertError) throw insertError;

      setIsModalOpen(false);
      setNewManager({ name: '', email: '', password: '', project_id: '' });
      fetchManagers();
      alert('Manager created successfully. They can log in immediately.');

    } catch (err) {
      console.error('Add manager failed:', err);
      alert(err.message || 'Failed to create manager.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-text-muted mt-1">Manage your team</p>
      </div>

      {/* Manage Team */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary" /> Manage Team
          </h2>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center text-sm py-2">
            <UserPlus className="w-4 h-4 mr-2" /> Add Manager
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : managers.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No managers added yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-navy border-b border-border">
                    <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Manager</th>
                    <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Assigned Project</th>
                    <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                    <th className="p-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map(manager => (
                    <tr key={manager.id} className="border-b border-border/50 hover:bg-navy-lighter/30 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-white">{manager.name}</p>
                        <p className="text-xs text-text-muted">{manager.email}</p>
                      </td>
                      <td className="p-4 text-sm text-text-main">{manager.projects?.name || '—'}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${manager.role === 'manager' ? 'bg-success/10 text-success border-success/20' : 'bg-text-muted/10 text-text-muted border-text-muted/20'}`}>
                          {manager.role === 'manager' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {manager.role === 'manager' && (
                          <button onClick={() => deactivateManager(manager.id)} className="text-xs text-danger hover:text-red-400 font-medium transition-colors">
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Manager Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-light border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Add New Manager</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManager} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-muted">Full Name</label>
                <input required type="text" value={newManager.name} onChange={e => setNewManager({...newManager, name: e.target.value})} className="input-field" placeholder="e.g. Amit Kumar" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-muted">Email Address</label>
                <input required type="email" value={newManager.email} onChange={e => setNewManager({...newManager, email: e.target.value})} className="input-field" placeholder="amit@gmail.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-muted">Temporary Password</label>
                <input required type="text" minLength={6} value={newManager.password} onChange={e => setNewManager({...newManager, password: e.target.value})} className="input-field" placeholder="Min 6 characters" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-muted">Assign Project</label>
                <select required value={newManager.project_id} onChange={e => setNewManager({...newManager, project_id: e.target.value})} className="input-field appearance-none">
                  <option value="">Select a project</option>
                  {projects?.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1" disabled={submitting}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}