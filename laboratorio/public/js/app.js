/* =====================================================================
   TurnoConnect - Lógica de la interfaz web en tiempo real (Parte 3)
   Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
   =====================================================================
   ARQUITECTURA DEL CLIENTE
   ------------------------
   - Las OPERACIONES (crear, iniciar, finalizar, eliminar) se envían a la
     API REST con el token JWT en el encabezado Authorization.
   - Las ACTUALIZACIONES llegan por WebSocket (Socket.IO). El servidor
     difunde el evento a TODOS los navegadores conectados, por lo que no
     es necesario recargar la página.
   - El servidor es el único que valida los estados: si dos usuarios
     intentan iniciar el mismo turno, el segundo recibe HTTP 409.
   ===================================================================== */
'use strict';

(() => {
  // ---------------------------------------------------------------
  //  Estado en memoria del cliente
  // ---------------------------------------------------------------
  const estado = {
    token: localStorage.getItem('tc_token') || null,
    usuario: localStorage.getItem('tc_usuario') || null,
    turnos: [],
    estadisticas: { pendientes: 0, enAtencion: 0, finalizados: 0, total: 0 },
    filtro: '',
    socket: null
  };

  // ---------------------------------------------------------------
  //  Referencias al DOM
  // ---------------------------------------------------------------
  const $ = (id) => document.getElementById(id);

  const dom = {
    pantallaLogin: $('pantallaLogin'),
    pantallaApp: $('pantallaApp'),
    formLogin: $('formLogin'),
    loginNombre: $('loginNombre'),
    loginPassword: $('loginPassword'),
    loginError: $('loginError'),
    btnIrRegistro: $('btnIrRegistro'),
    btnSalir: $('btnSalir'),

    indicadorConexion: $('indicadorConexion'),
    textoConexion: $('textoConexion'),
    contadorClientes: $('contadorClientes'),

    statPendientes: $('statPendientes'),
    statEnAtencion: $('statEnAtencion'),
    statFinalizados: $('statFinalizados'),
    statTotal: $('statTotal'),

    formTurno: $('formTurno'),
    turnoSolicitante: $('turnoSolicitante'),
    turnoTipo: $('turnoTipo'),

    cuerpoTabla: $('cuerpoTabla'),
    filtros: $('filtros'),
    bitacora: $('bitacora'),
    toasts: $('toasts')
  };

  // ===============================================================
  //  Utilidades de interfaz
  // ===============================================================

  /** Muestra una notificación flotante. */
  function toast(mensaje, tipo = 'info', duracion = 4000) {
    const el = document.createElement('div');
    el.className = `toast toast--${tipo}`;
    el.textContent = mensaje;
    dom.toasts.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(() => el.remove(), 300);
    }, duracion);
  }

  /** Agrega una entrada a la bitácora de eventos en vivo. */
  function registrarBitacora(mensaje, tipo = '', fecha = new Date()) {
    const vacia = dom.bitacora.querySelector('.bitacora__vacia');
    if (vacia) vacia.remove();

    const li = document.createElement('li');
    li.className = tipo ? `tipo-${tipo}` : '';
    li.innerHTML = `<strong>${escapar(mensaje)}</strong><time>${new Date(
      fecha
    ).toLocaleTimeString('es-EC')}</time>`;
    dom.bitacora.prepend(li);

    // Máximo 40 entradas visibles
    while (dom.bitacora.children.length > 40) {
      dom.bitacora.lastElementChild.remove();
    }
  }

  /** Evita inyección de HTML al mostrar datos del usuario. */
  function escapar(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, (c) => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Formatea una fecha ISO a hora local legible. */
  function formatearFecha(valor) {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /** Clase CSS del estado. */
  function claseEstado(estadoTurno) {
    if (estadoTurno === 'Pendiente') return 'pendiente';
    if (estadoTurno === 'En atención') return 'atencion';
    return 'finalizado';
  }

  // ===============================================================
  //  Cliente de la API REST
  // ===============================================================

  /**
   * Realiza una petición a la API incluyendo el token JWT.
   * @param {string} ruta
   * @param {{metodo?: string, cuerpo?: object}} [opciones]
   */
  async function api(ruta, opciones = {}) {
    const config = {
      method: opciones.metodo || 'GET',
      headers: { 'Content-Type': 'application/json' }
    };

    if (estado.token) {
      config.headers.Authorization = `Bearer ${estado.token}`;
    }
    if (opciones.cuerpo) {
      config.body = JSON.stringify(opciones.cuerpo);
    }

    const respuesta = await fetch(ruta, config);
    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (_e) {
      datos = null;
    }

    if (!respuesta.ok) {
      // Token inválido o expirado -> volver al login
      if (respuesta.status === 401) {
        cerrarSesion(true);
      }
      const mensaje = (datos && (datos.error || datos.mensaje)) || `Error HTTP ${respuesta.status}`;
      const error = new Error(mensaje);
      error.status = respuesta.status;
      throw error;
    }

    return datos;
  }

  // ===============================================================
  //  Autenticación
  // ===============================================================

  async function iniciarSesion(evento) {
    if (evento) evento.preventDefault();
    dom.loginError.classList.add('oculto');

    const nombre = dom.loginNombre.value.trim();
    const password = dom.loginPassword.value;

    try {
      const respuesta = await api('/api/auth/login', {
        metodo: 'POST',
        cuerpo: { nombre, password }
      });

      estado.token = respuesta.datos.token;
      estado.usuario = respuesta.datos.usuario.nombre;
      localStorage.setItem('tc_token', estado.token);
      localStorage.setItem('tc_usuario', estado.usuario);

      toast(`Bienvenido ${estado.usuario}`, 'exito');
      entrarAlPanel();
    } catch (error) {
      dom.loginError.textContent = error.message;
      dom.loginError.classList.remove('oculto');
    }
  }

  async function registrarUsuario() {
    dom.loginError.classList.add('oculto');

    const nombre = dom.loginNombre.value.trim();
    const password = dom.loginPassword.value;

    if (nombre.length < 3) {
      dom.loginError.textContent = 'El usuario debe tener al menos 3 caracteres.';
      dom.loginError.classList.remove('oculto');
      return;
    }
    if (password.length < 6) {
      dom.loginError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      dom.loginError.classList.remove('oculto');
      return;
    }

    try {
      const respuesta = await api('/api/auth/registro', {
        metodo: 'POST',
        cuerpo: { nombre, password }
      });

      estado.token = respuesta.datos.token;
      estado.usuario = respuesta.datos.usuario.nombre;
      localStorage.setItem('tc_token', estado.token);
      localStorage.setItem('tc_usuario', estado.usuario);

      toast(`Cuenta creada: ${estado.usuario}`, 'exito');
      entrarAlPanel();
    } catch (error) {
      dom.loginError.textContent = error.message;
      dom.loginError.classList.remove('oculto');
    }
  }

  function cerrarSesion(silencioso = false) {
    estado.token = null;
    estado.usuario = null;
    localStorage.removeItem('tc_token');
    localStorage.removeItem('tc_usuario');

    if (estado.socket) {
      estado.socket.disconnect();
      estado.socket = null;
    }

    dom.pantallaApp.classList.add('oculto');
    dom.pantallaLogin.classList.remove('oculto');
    dom.btnSalir.classList.add('oculto');
    dom.loginPassword.value = '';
    marcarConexion(false);

    if (!silencioso) toast('Sesión cerrada', 'info');
  }

  /** Muestra el panel principal y conecta el WebSocket. */
  function entrarAlPanel() {
    dom.pantallaLogin.classList.add('oculto');
    dom.pantallaApp.classList.remove('oculto');
    dom.btnSalir.classList.remove('oculto');

    registrarBitacora(`Sesión iniciada como ${estado.usuario}`, 'creado');
    conectarWebSocket();
    cargarTurnos();
  }

  // ===============================================================
  //  WebSocket (Socket.IO)
  // ===============================================================

  function conectarWebSocket() {
    if (estado.socket) estado.socket.disconnect();

    // El nombre de usuario viaja en el handshake para identificarlo
    const socket = io({ auth: { usuario: estado.usuario } });
    estado.socket = socket;

    socket.on('connect', () => {
      marcarConexion(true);
      registrarBitacora('Conectado por WebSocket al servidor', 'creado');
    });

    socket.on('disconnect', () => {
      marcarConexion(false);
      registrarBitacora('Desconectado del servidor WebSocket', 'eliminado');
    });

    socket.on('connect_error', () => marcarConexion(false));

    // --- Estado completo al conectarse (late joiners) -------------
    socket.on('estado:inicial', (payload) => {
      estado.turnos = payload.turnos || [];
      if (payload.estadisticas) estado.estadisticas = payload.estadisticas;
      if (typeof payload.conectados === 'number') {
        dom.contadorClientes.textContent = payload.conectados;
      }
      renderizar();
    });

    // --- Turno creado (desde REST, TCP o cualquier cliente) --------
    socket.on('turno:creado', (payload) => {
      if (!payload.turno) return;
      const existe = estado.turnos.some((t) => t.id === payload.turno.id);
      if (!existe) estado.turnos.push(payload.turno);
      renderizar(payload.turno.id);
      registrarBitacora(payload.mensaje, 'creado', payload.fecha);
      toast(payload.mensaje, 'exito');
    });

    // --- Turno actualizado ----------------------------------------
    socket.on('turno:actualizado', (payload) => {
      if (!payload.turno) return;
      const indice = estado.turnos.findIndex((t) => t.id === payload.turno.id);
      if (indice >= 0) estado.turnos[indice] = payload.turno;
      else estado.turnos.push(payload.turno);

      renderizar(payload.turno.id);
      registrarBitacora(payload.mensaje, payload.accion || 'actualizar', payload.fecha);
      toast(payload.mensaje, payload.accion === 'finalizar' ? 'exito' : 'info');
    });

    // --- Turno eliminado ------------------------------------------
    socket.on('turno:eliminado', (payload) => {
      if (!payload.turno) return;
      estado.turnos = estado.turnos.filter((t) => t.id !== payload.turno.id);
      renderizar();
      registrarBitacora(payload.mensaje, 'eliminado', payload.fecha);
      toast(payload.mensaje, 'info');
    });

    // --- Estadísticas recalculadas por el servidor -----------------
    socket.on('estadisticas', (stats) => {
      estado.estadisticas = stats;
      renderizarIndicadores();
    });

    // --- Número de navegadores conectados --------------------------
    socket.on('clientes:total', (payload) => {
      dom.contadorClientes.textContent = payload.conectados;
    });

    // --- Avisos genéricos -----------------------------------------
    socket.on('aviso', (payload) => {
      toast(payload.mensaje, payload.tipo === 'error' ? 'error' : 'info');
    });
  }

  function marcarConexion(conectado) {
    dom.indicadorConexion.className = `punto punto--${conectado ? 'conectado' : 'desconectado'}`;
    dom.textoConexion.textContent = conectado ? 'En tiempo real' : 'Desconectado';
  }

  // ===============================================================
  //  Operaciones sobre turnos (REST)
  // ===============================================================

  async function cargarTurnos() {
    try {
      const respuesta = await api('/api/turnos');
      estado.turnos = respuesta.datos || [];
      renderizar();
    } catch (error) {
      toast(`No se pudieron cargar los turnos: ${error.message}`, 'error');
    }
  }

  async function crearTurno(evento) {
    evento.preventDefault();
    const solicitante = dom.turnoSolicitante.value.trim();
    const tipoAtencion = dom.turnoTipo.value;

    if (solicitante.length < 3) {
      toast('El nombre del solicitante debe tener al menos 3 caracteres', 'error');
      return;
    }

    try {
      const respuesta = await api('/api/turnos', {
        metodo: 'POST',
        cuerpo: { solicitante, tipoAtencion }
      });
      dom.turnoSolicitante.value = '';
      dom.turnoSolicitante.focus();
      toast(respuesta.mensaje, 'exito');
      // La tabla se actualiza cuando llega el evento por WebSocket
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function iniciarTurno(id) {
    try {
      const respuesta = await api(`/api/turnos/${id}/iniciar`, { metodo: 'PATCH' });
      toast(respuesta.mensaje, 'exito');
    } catch (error) {
      // 409 = otro usuario ya tomó el turno
      toast(error.message, 'error', 6000);
    }
  }

  async function finalizarTurno(id) {
    try {
      const respuesta = await api(`/api/turnos/${id}/finalizar`, { metodo: 'PATCH' });
      toast(respuesta.mensaje, 'exito');
    } catch (error) {
      toast(error.message, 'error', 6000);
    }
  }

  async function eliminarTurno(id, codigo) {
    if (!window.confirm(`¿Eliminar el turno ${codigo}? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      const respuesta = await api(`/api/turnos/${id}`, { metodo: 'DELETE' });
      toast(respuesta.mensaje, 'info');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  // ===============================================================
  //  Renderizado
  // ===============================================================

  function renderizar(idDestacado = null) {
    renderizarIndicadores();
    renderizarTabla(idDestacado);
  }

  function renderizarIndicadores() {
    const s = estado.estadisticas || {};
    dom.statPendientes.textContent = s.pendientes ?? 0;
    dom.statEnAtencion.textContent = s.enAtencion ?? 0;
    dom.statFinalizados.textContent = s.finalizados ?? 0;
    dom.statTotal.textContent = s.total ?? estado.turnos.length;
  }

  function renderizarTabla(idDestacado = null) {
    const filtrados = estado.filtro
      ? estado.turnos.filter((t) => t.estado === estado.filtro)
      : estado.turnos;

    if (filtrados.length === 0) {
      dom.cuerpoTabla.innerHTML = `<tr><td colspan="7" class="tabla__vacia">${
        estado.filtro ? 'No hay turnos en este estado.' : 'Aún no hay turnos registrados.'
      }</td></tr>`;
      return;
    }

    // Orden: pendientes y en atención primero, luego por fecha de registro
    const orden = { Pendiente: 0, 'En atención': 1, Finalizado: 2 };
    const lista = [...filtrados].sort((a, b) => {
      const porEstado = (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9);
      if (porEstado !== 0) return porEstado;
      return new Date(a.fechaRegistro) - new Date(b.fechaRegistro);
    });

    dom.cuerpoTabla.innerHTML = lista
      .map((t) => {
        const clase = claseEstado(t.estado);
        const destacada = t.id === idDestacado ? 'fila-destacada' : '';

        // Responsable del último cambio de estado
        let responsable = '<span class="responsable">—</span>';
        if (t.estado === 'En atención' && t.iniciadoPor) {
          responsable = `<span class="responsable">En atención por<br><strong>${escapar(
            t.iniciadoPor
          )}</strong><br>${formatearFecha(t.iniciadoEn)}</span>`;
        } else if (t.estado === 'Finalizado') {
          responsable = `<span class="responsable">Finalizado por<br><strong>${escapar(
            t.finalizadoPor || '—'
          )}</strong><br>${formatearFecha(t.finalizadoEn)}</span>`;
        }

        // Botones según el estado permitido por el servidor
        let acciones = '';
        if (t.estado === 'Pendiente') {
          acciones += `<button class="btn btn--mini btn--iniciar" data-accion="iniciar" data-id="${t.id}">Iniciar atención</button>`;
        }
        if (t.estado === 'En atención') {
          acciones += `<button class="btn btn--mini btn--finalizar" data-accion="finalizar" data-id="${t.id}">Finalizar</button>`;
        }
        acciones += `<button class="btn btn--mini btn--eliminar" data-accion="eliminar" data-id="${t.id}" data-codigo="${escapar(
          t.codigo
        )}">Eliminar</button>`;

        return `
          <tr class="${destacada}">
            <td><span class="codigo-turno">${escapar(t.codigo)}</span></td>
            <td>${escapar(t.solicitante)}</td>
            <td>${escapar(t.tipoAtencion)}</td>
            <td>
              <span class="badge badge--${clase}">
                <span class="badge__punto"></span>${escapar(t.estado)}
              </span>
            </td>
            <td>${formatearFecha(t.fechaRegistro)}</td>
            <td>${responsable}</td>
            <td><div class="acciones">${acciones}</div></td>
          </tr>`;
      })
      .join('');
  }

  // ===============================================================
  //  Eventos de la interfaz
  // ===============================================================

  dom.formLogin.addEventListener('submit', iniciarSesion);
  dom.btnIrRegistro.addEventListener('click', registrarUsuario);
  dom.btnSalir.addEventListener('click', () => cerrarSesion(false));
  dom.formTurno.addEventListener('submit', crearTurno);

  // Delegación de eventos para los botones de la tabla
  dom.cuerpoTabla.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton) return;

    const { accion, id, codigo } = boton.dataset;
    boton.disabled = true;

    if (accion === 'iniciar') iniciarTurno(id);
    if (accion === 'finalizar') finalizarTurno(id);
    if (accion === 'eliminar') eliminarTurno(id, codigo);

    // Se reactiva tras un breve lapso (el render llega por WebSocket)
    setTimeout(() => {
      boton.disabled = false;
    }, 1200);
  });

  // Filtros por estado
  dom.filtros.addEventListener('click', (evento) => {
    const chip = evento.target.closest('.chip');
    if (!chip) return;
    estado.filtro = chip.dataset.filtro;
    dom.filtros
      .querySelectorAll('.chip')
      .forEach((c) => c.classList.toggle('chip--activo', c === chip));
    renderizarTabla();
  });

  // ===============================================================
  //  Arranque: si ya hay sesión guardada, entrar directamente
  // ===============================================================
  if (estado.token && estado.usuario) {
    entrarAlPanel();
  } else {
    dom.pantallaLogin.classList.remove('oculto');
    dom.pantallaApp.classList.add('oculto');
  }
})();
