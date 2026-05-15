import AdminGuard from '../../components/AdminGuard';
import { useRouter } from 'next/router';
import Head from 'next/head';

function AdminUsersContent() {
  // Mock users data (replace with real API)
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com', orders: 5, joined: '2024-01-15', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', orders: 12, joined: '2024-02-10', status: 'Active' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', orders: 3, joined: '2024-03-01', status: 'Active' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', orders: 8, joined: '2024-03-20', status: 'Inactive' },
  ];

  const router = useRouter();

  return (
    <>
      <Head>
        <title>Users - Admin</title>
      </Head>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button 
              onClick={() => router.back()}
              className="inline-flex items-center px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-lg font-medium rounded-xl mb-4 md:mb-0"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-rose-600 bg-clip-text text-transparent">
              Users List ({users.length})
            </h1>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-slate-900 dark:to-slate-800">
                <tr>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Name</th>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Email</th>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Orders</th>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Joined</th>
                  <th className="p-6 text-left text-lg font-bold text-gray-800 dark:text-slate-100">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="p-6 font-semibold text-lg">{user.name}</td>
                    <td className="p-6 text-blue-600 underline font-medium">{user.email}</td>
                    <td className="p-6">
                      <span className="text-2xl font-bold">{user.orders}</span>
                    </td>
                    <td className="p-6">{user.joined}</td>
                    <td className="p-6">
                      <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                        user.status === 'Active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200' 
                          : 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminUsers() {
  return <AdminGuard><AdminUsersContent /></AdminGuard>;
}
