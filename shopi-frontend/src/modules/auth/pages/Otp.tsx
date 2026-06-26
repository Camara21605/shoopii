import { useState } from 'react'
import { authService } from '../services/authService'
import { useAuth } from '../hooks/useAuth'

interface Props {
  email: string
}

export default function OtpPage({ email }: Props) {
  const { login } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const user = await authService.verifyOtp(email, code)
      login(user)
    } catch {
      setError('Code invalide')
    }
  }

  return (
    <div className="otp-page">
      <h1>Vérification</h1>
      <p>Entrez le code à 6 chiffres envoyé à {email}</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={e => setCode(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">Vérifier</button>
      </form>
    </div>
  )
}
