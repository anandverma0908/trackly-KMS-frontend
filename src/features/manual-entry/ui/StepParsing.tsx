import styles from '../ManualEntryPage.module.scss'

interface StepParsingProps {
  inputText:    string
  parsingStep:  number
  parsingSteps: string[]
}

export default function StepParsing({ inputText, parsingStep, parsingSteps }: StepParsingProps) {
  return (
    <div className={styles.parsingStep}>
      {/* Input preview — dimmed */}
      <div className={styles.parsingInputPreview}>
        <span className={styles.parsingQuote}>"</span>
        {inputText.slice(0, 200)}{inputText.length > 200 ? '…' : ''}
        <span className={styles.parsingQuote}>"</span>
      </div>

      {/* Steps */}
      <div className={styles.parsingCard}>
        <div className={styles.parsingSpinner} />
        <div className={styles.parsingSteps}>
          {parsingSteps.map((label, i) => {
            const isDone   = i < parsingStep
            const isActive = i === parsingStep
            return (
              <div
                key={label}
                className={`${styles.parsingStepRow} ${isDone ? styles.stepDone : ''} ${isActive ? styles.stepActive : ''}`}
              >
                <div className={styles.stepIndicator}>
                  {isDone ? '✓' : isActive ? '›' : '·'}
                </div>
                {label}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
