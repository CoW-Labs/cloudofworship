export interface SignupVisualState {
  step: number
  fullName: string
  churchName: string
  churchType: string
  churchPastor: string
  creatingForChurch: boolean
  invitedEmails: string[]
}

export const useSignupVisualState = () =>
  useState<SignupVisualState>("signup-visual-state", () => ({
    step: 1,
    fullName: "",
    churchName: "",
    churchType: "",
    churchPastor: "",
    creatingForChurch: true,
    invitedEmails: [],
  }))
