import React, { useState, useEffect } from 'react';
import { BarChart3, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Poll, PollOption, PollResults } from '../types';

interface PollViewProps {
  poll: Poll;
  options: PollOption[];
  messageId: number;
  currentUserId: string;
  className?: string;
}

const PollView: React.FC<PollViewProps> = ({
  poll,
  options,
  messageId,
  currentUserId,
  className,
}) => {
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());
  const [userVotes, setUserVotes] = useState<number[]>([]);
  const [results, setResults] = useState<PollResults>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const sortedOptions = [...options].sort((a, b) => a.optionIndex - b.optionIndex);

  // Load user's votes and results
  useEffect(() => {
    const loadPollData = async () => {
      try {
        // Get user's existing votes
        const votesResponse = await window.electronAPI.getUserPollVotes(
          poll.id,
          currentUserId
        );
        if (votesResponse.success && votesResponse.data) {
          setUserVotes(votesResponse.data);
          setHasVoted(votesResponse.data.length > 0);
          setShowResults(votesResponse.data.length > 0);
          setSelectedOptions(new Set(votesResponse.data));
        }

        // Get poll results
        const resultsResponse = await window.electronAPI.getPollResults(poll.id);
        if (resultsResponse.success && resultsResponse.data) {
          setResults(resultsResponse.data);
        }
      } catch (error) {
        console.error('Failed to load poll data:', error);
      }
    };

    loadPollData();
  }, [poll.id, currentUserId]);

  const handleOptionToggle = (optionId: number) => {
    if (hasVoted) return;

    setSelectedOptions((prev) => {
      const newSet = new Set(prev);
      if (poll.allowMultiple) {
        // Toggle for multiple choice
        if (newSet.has(optionId)) {
          newSet.delete(optionId);
        } else {
          newSet.add(optionId);
        }
      } else {
        // Replace for single choice
        newSet.clear();
        newSet.add(optionId);
      }
      return newSet;
    });
  };

  const handleVote = async () => {
    if (selectedOptions.size === 0) {
      toast.error('Please select at least one option');
      return;
    }

    if (isExpired()) {
      toast.error('This poll has expired');
      return;
    }

    setIsVoting(true);
    try {
      // Submit votes
      const votePromises = Array.from(selectedOptions).map((optionId) =>
        window.electronAPI.votePoll(poll.id, optionId, currentUserId)
      );

      const responses = await Promise.all(votePromises);
      const allSuccess = responses.every((r) => r.success);

      if (allSuccess) {
        toast.success('Vote submitted successfully');
        setHasVoted(true);
        setShowResults(true);
        setUserVotes(Array.from(selectedOptions));

        // Refresh results
        const resultsResponse = await window.electronAPI.getPollResults(poll.id);
        if (resultsResponse.success && resultsResponse.data) {
          setResults(resultsResponse.data);
        }
      } else {
        throw new Error('Failed to submit vote');
      }
    } catch (error) {
      console.error('Vote error:', error);
      toast.error('Failed to submit vote');
    } finally {
      setIsVoting(false);
    }
  };

  const isExpired = (): boolean => {
    return poll.expiresAt ? Date.now() > poll.expiresAt : false;
  };

  const getTimeRemaining = (): string => {
    if (!poll.expiresAt) return '';

    const msRemaining = poll.expiresAt - Date.now();
    if (msRemaining <= 0) return 'Expired';

    const hours = Math.floor(msRemaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    return 'Less than 1 hour left';
  };

  const getTotalVotes = (): number => {
    return Object.values(results).reduce((sum, option) => sum + option.count, 0);
  };

  const getPercentage = (count: number): number => {
    const total = getTotalVotes();
    return total > 0 ? Math.round((count / total) * 100) : 0;
  };

  const expired = isExpired();
  const totalVotes = getTotalVotes();

  return (
    <div className={cn('border rounded-lg p-4 bg-card', className)}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <BarChart3 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm mb-1">{poll.question}</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
            {poll.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getTimeRemaining()}
              </span>
            )}
            {poll.allowMultiple && <span>Multiple choice</span>}
          </div>
        </div>
      </div>

      {/* Options */}
      {!showResults ? (
        <div className="space-y-2 mb-4">
          {poll.allowMultiple ? (
            // Multiple choice
            sortedOptions.map((option) => (
              <label
                key={option.id}
                htmlFor={`option-${option.id}`}
                className={cn(
                  'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                  selectedOptions.has(option.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                )}
              >
                <Checkbox
                  id={`option-${option.id}`}
                  checked={selectedOptions.has(option.id)}
                  onCheckedChange={() => handleOptionToggle(option.id)}
                  disabled={hasVoted || expired}
                />
                <span className="text-sm flex-1">{option.optionText}</span>
              </label>
            ))
          ) : (
            // Single choice
            <RadioGroup
              value={Array.from(selectedOptions)[0]?.toString()}
              onValueChange={(value) => handleOptionToggle(parseInt(value, 10))}
            >
              {sortedOptions.map((option) => (
                <label
                  key={option.id}
                  htmlFor={`option-${option.id}`}
                  className={cn(
                    'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                    selectedOptions.has(option.id)
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  )}
                >
                  <RadioGroupItem
                    id={`option-${option.id}`}
                    value={option.id.toString()}
                    disabled={hasVoted || expired}
                  />
                  <span className="text-sm flex-1">{option.optionText}</span>
                </label>
              ))}
            </RadioGroup>
          )}
        </div>
      ) : (
        // Results view
        <div className="space-y-3 mb-4">
          {sortedOptions.map((option) => {
            const result = results[option.id];
            const count = result?.count || 0;
            const percentage = getPercentage(count);
            const isUserVote = userVotes.includes(option.id);

            return (
              <div key={option.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={cn('truncate', isUserVote && 'font-medium')}>
                      {option.optionText}
                    </span>
                    {isUserVote && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="text-muted-foreground shrink-0 ml-2">
                    {percentage}% ({count})
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!hasVoted && !expired ? (
          <Button
            onClick={handleVote}
            disabled={selectedOptions.size === 0 || isVoting}
            size="sm"
            className="w-full"
          >
            {isVoting ? 'Submitting...' : 'Vote'}
          </Button>
        ) : showResults ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResults(false)}
            disabled={!hasVoted}
          >
            View Options
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowResults(true)}>
            View Results
          </Button>
        )}
        {expired && (
          <div className="text-xs text-destructive ml-auto">Poll has expired</div>
        )}
      </div>
    </div>
  );
};

export default PollView;
