import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import CoworkView from '../components/CoworkView.vue'
import TasksView from '../components/TasksView.vue'
import NotesView from '../components/NotesView.vue'
import ConnectorsView from '../components/ConnectorsView.vue'
import AgentOutputView from '../components/AgentOutputView.vue'
import SettingsView from '../components/SettingsView.vue'
import ChatPanel from '../components/ChatPanel.vue'
import PlansView from '../components/PlansView.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/cowork' },
  { path: '/cowork', name: 'cowork', component: CoworkView },
  { path: '/chat', name: 'chat', component: ChatPanel },
  { path: '/tasks', name: 'tasks', component: TasksView },
  { path: '/notes', name: 'notes', component: NotesView },
  { path: '/connectors', name: 'connectors', component: ConnectorsView },
  { path: '/agent-output', name: 'agent-output', component: AgentOutputView },
  { path: '/plans', name: 'plans', component: PlansView },
  { path: '/settings', redirect: '/settings/general' },
  { path: '/settings/:tab', name: 'settings', component: SettingsView, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/cowork' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
